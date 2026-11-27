import type { Context, Hono } from 'hono';
import type { Env } from '../server';
import { cafeDate, utcWindow } from './operations';
import { escapeHtml, getTelegramConfig, money, sendTelegramMessage } from './telegram';
import { purchaseOrderText, reorderQuantity, WASTE_REASONS, type PurchaseOrder, type PurchaseOrderStatus, type Supplier } from '../utils/purchasing';

type Row = Record<string, any>;
const round = (value: number, digits = 3) => Number(value.toFixed(digits));

function supplierFields(body: Row): { error: string } | Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'> {
  const text = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
  const name = text(body.name, 100);
  const leadTimeDays = Math.round(Number(body.leadTimeDays ?? 1));
  if (!name) return { error: 'Give the supplier a name.' };
  if (!Number.isFinite(leadTimeDays) || leadTimeDays < 0 || leadTimeDays > 90) return { error: 'Lead time is 0 to 90 days.' };
  return { name, phone: text(body.phone, 40), telegram: text(body.telegram, 100), leadTimeDays, notes: text(body.notes, 1000) };
}

const supplierRow = (row: Row): Supplier => ({
  id: row.id, name: row.name, phone: row.phone, telegram: row.telegram, leadTimeDays: Number(row.lead_time_days),
  notes: row.notes, createdAt: row.created_at, updatedAt: row.updated_at
});

/** Purchase orders with their lines, newest first; one order when `id` is given. */
export async function listPurchaseOrders(db: D1Database, id?: string): Promise<PurchaseOrder[]> {
  const where = id ? 'WHERE po.id = ?' : '';
  const orders = (await db.prepare(`SELECT po.*, s.name AS supplier_name FROM purchase_orders po LEFT JOIN suppliers s ON s.id = po.supplier_id ${where} ORDER BY po.created_at DESC LIMIT 100`).bind(...(id ? [id] : [])).all<Row>()).results;
  if (!orders.length) return [];
  const ids = orders.map(o => o.id);
  const lines = (await db.prepare(`SELECT l.*, st.name, st.unit FROM purchase_order_lines l LEFT JOIN stock_items st ON st.id = l.stock_item_id WHERE l.purchase_order_id IN (${ids.map(() => '?').join(',')}) ORDER BY st.name`).bind(...ids).all<Row>()).results;
  return orders.map(o => ({
    id: o.id, supplierId: o.supplier_id, supplierName: o.supplier_name || '', status: o.status, notes: o.notes, expectedOn: o.expected_on,
    createdAt: o.created_at, updatedAt: o.updated_at, sentAt: o.sent_at, receivedAt: o.received_at,
    lines: lines.filter(l => l.purchase_order_id === o.id).map(l => ({
      id: l.id, stockItemId: l.stock_item_id, name: l.name || 'Removed material', unit: l.unit || '',
      quantity: Number(l.quantity), unitCost: Number(l.unit_cost), receivedQuantity: Number(l.received_quantity)
    }))
  }));
}

async function validLines(db: D1Database, input: unknown) {
  if (!Array.isArray(input) || !input.length || input.length > 100) return { error: 'Add at least one material to the order.' };
  const lines = input.map((l: Row) => ({ stockItemId: String(l?.stockItemId || ''), quantity: Number(l?.quantity), unitCost: Number(l?.unitCost ?? 0) }));
  if (lines.some(l => !l.stockItemId || !Number.isFinite(l.quantity) || l.quantity <= 0 || l.quantity > 1e6 || !Number.isFinite(l.unitCost) || l.unitCost < 0)) return { error: 'Each line needs a quantity above zero and a cost of zero or more.' };
  if (new Set(lines.map(l => l.stockItemId)).size !== lines.length) return { error: 'Each material can appear only once.' };
  const found = (await db.prepare(`SELECT id FROM stock_items WHERE id IN (${lines.map(() => '?').join(',')})`).bind(...lines.map(l => l.stockItemId)).all<Row>()).results;
  if (found.length !== lines.length) return { error: 'A material on this order no longer exists.' };
  return { lines };
}

const insertLines = (db: D1Database, orderId: string, lines: Array<{ stockItemId: string; quantity: number; unitCost: number }>) => lines.map(l =>
  db.prepare('INSERT INTO purchase_order_lines (id, purchase_order_id, stock_item_id, quantity, unit_cost) VALUES (?, ?, ?, ?, ?)').bind(`pol-${crypto.randomUUID()}`, orderId, l.stockItemId, round(l.quantity), round(l.unitCost, 4)));

/**
 * Draft purchase orders for everything at or below its reorder level, one per supplier (materials without one share
 * a draft). Materials already on an open order are left out, so pressing it twice does not order twice.
 */
export async function createReorderDrafts(db: D1Database) {
  const { results } = await db.prepare(`SELECT * FROM stock_items WHERE quantity <= min_threshold AND id NOT IN (
    SELECT l.stock_item_id FROM purchase_order_lines l JOIN purchase_orders po ON po.id = l.purchase_order_id WHERE po.status IN ('draft','sent')
  ) ORDER BY name`).all<Row>();
  const groups = new Map<string, Row[]>();
  for (const item of results) {
    if (!reorderQuantity({ quantity: Number(item.quantity), minThreshold: Number(item.min_threshold) })) continue;
    const key = item.supplier_id || '';
    groups.set(key, [...(groups.get(key) || []), item]);
  }
  const suppliers = new Map((await db.prepare('SELECT id, lead_time_days FROM suppliers').all<Row>()).results.map(s => [s.id, Number(s.lead_time_days)]));
  const now = new Date();
  const created: string[] = [];
  const statements: D1PreparedStatement[] = [];
  for (const [supplierId, items] of groups) {
    const id = `po-${crypto.randomUUID()}`;
    const supplier = supplierId && suppliers.has(supplierId) ? supplierId : null;
    const expectedOn = supplier ? new Date(now.getTime() + suppliers.get(supplier)! * 86_400_000).toISOString().slice(0, 10) : '';
    statements.push(db.prepare("INSERT INTO purchase_orders (id, supplier_id, status, notes, expected_on, created_at, updated_at) VALUES (?, ?, 'draft', '', ?, ?, ?)").bind(id, supplier, expectedOn, now.toISOString(), now.toISOString()));
    statements.push(...insertLines(db, id, items.map(item => ({ stockItemId: item.id, quantity: reorderQuantity({ quantity: Number(item.quantity), minThreshold: Number(item.min_threshold) }), unitCost: Number(item.unit_cost) }))));
    created.push(id);
  }
  if (statements.length) await db.batch(statements);
  return created;
}

async function cafeName(db: D1Database) {
  return String((await db.prepare('SELECT cafe_name FROM settings WHERE id = ?').bind('cafe_config').first<Row>())?.cafe_name || 'our café');
}

/** Waste by reason and material, and each material's expected use against what counts found, between two café dates. */
async function stockReport(db: D1Database, from: string, to: string) {
  const config = await db.prepare('SELECT time_zone FROM settings WHERE id = ?').bind('cafe_config').first<Row>();
  const timeZone = String(config?.time_zone || 'Asia/Tehran');
  const { results } = await db.prepare(
    'SELECT m.stock_item_id, m.kind, m.quantity, m.reason, m.notes, m.order_id, m.created_at, s.name, s.unit, s.unit_cost FROM inventory_movements m JOIN stock_items s ON s.id = m.stock_item_id WHERE m.created_at >= ? AND m.created_at < ?'
  ).bind(utcWindow(from)[0], utcWindow(to)[1]).all<Row>();
  const inRange = results.filter(m => { const day = cafeDate(new Date(m.created_at), timeZone); return day >= from && day <= to; });
  const reasons = new Map<string, { reason: string; cost: number; count: number }>();
  const materials = new Map<string, { stockItemId: string; name: string; unit: string; unitCost: number; used: number; wasted: number; wasteCost: number; adjusted: number; purchased: number }>();
  for (const m of inRange) {
    const quantity = Number(m.quantity), unitCost = Number(m.unit_cost);
    const material = materials.get(m.stock_item_id) || { stockItemId: m.stock_item_id, name: m.name, unit: m.unit, unitCost, used: 0, wasted: 0, wasteCost: 0, adjusted: 0, purchased: 0 };
    if (m.kind === 'consumption' || (m.kind === 'return' && m.order_id)) material.used -= quantity;
    else if (m.kind === 'waste') {
      material.wasted -= quantity; material.wasteCost -= quantity * unitCost;
      const reason = m.reason || 'other';
      const entry = reasons.get(reason) || { reason, cost: 0, count: 0 };
      entry.cost -= quantity * unitCost; entry.count += 1;
      reasons.set(reason, entry);
    } else if (m.kind === 'adjustment') material.adjusted += quantity;
    else if (m.kind === 'purchase') material.purchased += quantity;
    materials.set(m.stock_item_id, material);
  }
  const rows = [...materials.values()].map(m => ({
    ...m, used: round(m.used), wasted: round(m.wasted), wasteCost: round(m.wasteCost, 2), adjusted: round(m.adjusted), purchased: round(m.purchased),
    adjustedCost: round(m.adjusted * m.unitCost, 2),
    /** Count corrections against what recipes say was used: negative is stock that went missing. */
    variancePercent: m.used > 0 ? round(m.adjusted / m.used * 100, 1) : null
  }));
  return {
    from, to,
    wasteCost: round(rows.reduce((sum, m) => sum + m.wasteCost, 0), 2),
    shrinkageCost: round(-rows.reduce((sum, m) => sum + Math.min(0, m.adjustedCost), 0), 2),
    byReason: [...reasons.values()].map(r => ({ ...r, cost: round(r.cost, 2) })).sort((a, b) => b.cost - a.cost),
    materials: rows.sort((a, b) => (b.wasteCost - Math.min(0, b.adjustedCost)) - (a.wasteCost - Math.min(0, a.adjustedCost)) || a.name.localeCompare(b.name))
  };
}

export function registerPurchasing(app: Hono<Env>) {
  app.get('/api/suppliers', async c => {
    const { results } = await c.env.DB.prepare('SELECT * FROM suppliers ORDER BY name COLLATE NOCASE').all<Row>();
    return c.json({ data: results.map(supplierRow) });
  });
  app.post('/api/suppliers', async c => {
    const fields = supplierFields(await c.req.json());
    if ('error' in fields) return c.json({ success: false, message: fields.error }, 400);
    const now = new Date().toISOString();
    const supplier: Supplier = { id: `sup-${crypto.randomUUID()}`, ...fields, createdAt: now, updatedAt: now };
    await c.env.DB.prepare('INSERT INTO suppliers (id, name, phone, telegram, lead_time_days, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(supplier.id, supplier.name, supplier.phone, supplier.telegram, supplier.leadTimeDays, supplier.notes, now, now).run();
    return c.json({ success: true, data: supplier });
  });
  app.put('/api/suppliers/:id', async c => {
    const id = c.req.param('id');
    const current = await c.env.DB.prepare('SELECT * FROM suppliers WHERE id = ?').bind(id).first<Row>();
    if (!current) return c.json({ success: false, message: 'Supplier not found.' }, 404);
    const fields = supplierFields({ ...supplierRow(current), ...await c.req.json() });
    if ('error' in fields) return c.json({ success: false, message: fields.error }, 400);
    const updatedAt = new Date().toISOString();
    await c.env.DB.prepare('UPDATE suppliers SET name = ?, phone = ?, telegram = ?, lead_time_days = ?, notes = ?, updated_at = ? WHERE id = ?')
      .bind(fields.name, fields.phone, fields.telegram, fields.leadTimeDays, fields.notes, updatedAt, id).run();
    return c.json({ success: true, data: { ...supplierRow(current), ...fields, updatedAt } });
  });
  // Its materials and past orders stay; they just no longer name it.
  app.delete('/api/suppliers/:id', async c => {
    const id = c.req.param('id');
    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE stock_items SET supplier_id = NULL WHERE supplier_id = ?').bind(id),
      c.env.DB.prepare('UPDATE purchase_orders SET supplier_id = NULL WHERE supplier_id = ?').bind(id),
      c.env.DB.prepare('DELETE FROM suppliers WHERE id = ?').bind(id)
    ]);
    return c.json({ success: true });
  });

  app.get('/api/purchase-orders', async c => c.json({ data: await listPurchaseOrders(c.env.DB) }));

  app.post('/api/purchase-orders/reorder', async c => {
    const ids = await createReorderDrafts(c.env.DB);
    return c.json({ success: true, created: ids.length, data: await listPurchaseOrders(c.env.DB) });
  });

  const checkSupplier = async (c: Context<Env>, supplierId: unknown) => {
    if (supplierId === null || supplierId === undefined || supplierId === '') return { supplierId: null };
    return await c.env.DB.prepare('SELECT id FROM suppliers WHERE id = ?').bind(String(supplierId)).first() ? { supplierId: String(supplierId) } : { error: 'That supplier no longer exists.' };
  };
  const expectedOn = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';

  app.post('/api/purchase-orders', async c => {
    const body = await c.req.json();
    const supplier = await checkSupplier(c, body.supplierId);
    if ('error' in supplier) return c.json({ success: false, message: supplier.error }, 400);
    const checked = await validLines(c.env.DB, body.lines);
    if ('error' in checked) return c.json({ success: false, message: checked.error }, 400);
    const id = `po-${crypto.randomUUID()}`, now = new Date().toISOString();
    await c.env.DB.batch([
      c.env.DB.prepare("INSERT INTO purchase_orders (id, supplier_id, status, notes, expected_on, created_at, updated_at) VALUES (?, ?, 'draft', ?, ?, ?, ?)")
        .bind(id, supplier.supplierId, String(body.notes || '').trim().slice(0, 1000), expectedOn(body.expectedOn), now, now),
      ...insertLines(c.env.DB, id, checked.lines)
    ]);
    return c.json({ success: true, data: (await listPurchaseOrders(c.env.DB, id))[0] });
  });

  app.put('/api/purchase-orders/:id', async c => {
    const id = c.req.param('id');
    const [current] = await listPurchaseOrders(c.env.DB, id);
    if (!current) return c.json({ success: false, message: 'Purchase order not found.' }, 404);
    if (current.status === 'received' || current.status === 'cancelled') return c.json({ success: false, message: 'Received and cancelled orders cannot change.' }, 409);
    const body = await c.req.json();
    const status: PurchaseOrderStatus = body.status === undefined ? current.status : body.status;
    if (!['draft', 'sent', 'cancelled'].includes(status)) return c.json({ success: false, message: 'Invalid status.' }, 400);
    const supplier = body.supplierId === undefined ? { supplierId: current.supplierId } : await checkSupplier(c, body.supplierId);
    if ('error' in supplier) return c.json({ success: false, message: supplier.error }, 400);
    const statements: D1PreparedStatement[] = [];
    if (body.lines !== undefined) {
      const checked = await validLines(c.env.DB, body.lines);
      if ('error' in checked) return c.json({ success: false, message: checked.error }, 400);
      statements.push(c.env.DB.prepare('DELETE FROM purchase_order_lines WHERE purchase_order_id = ?').bind(id), ...insertLines(c.env.DB, id, checked.lines));
    }
    const now = new Date().toISOString();
    statements.unshift(c.env.DB.prepare('UPDATE purchase_orders SET supplier_id = ?, status = ?, notes = ?, expected_on = ?, updated_at = ?, sent_at = CASE WHEN ? = \'sent\' AND sent_at IS NULL THEN ? ELSE sent_at END WHERE id = ?')
      .bind(supplier.supplierId, status, body.notes === undefined ? current.notes : String(body.notes).trim().slice(0, 1000), body.expectedOn === undefined ? current.expectedOn : expectedOn(body.expectedOn), now, status, now, id));
    await c.env.DB.batch(statements);
    return c.json({ success: true, data: (await listPurchaseOrders(c.env.DB, id))[0] });
  });

  // What arrived goes into stock as purchases. Costs on the delivery note can update each material's unit cost.
  app.post('/api/purchase-orders/:id/receive', async c => {
    const id = c.req.param('id');
    const [current] = await listPurchaseOrders(c.env.DB, id);
    if (!current) return c.json({ success: false, message: 'Purchase order not found.' }, 404);
    if (current.status === 'received' || current.status === 'cancelled') return c.json({ success: false, message: 'This order was already closed.' }, 409);
    const body = await c.req.json();
    const received = new Map<string, Row>((Array.isArray(body.lines) ? body.lines : []).map((l: Row) => [String(l?.id), l]));
    const now = new Date().toISOString();
    const statements: D1PreparedStatement[] = [];
    for (const line of current.lines) {
      const input = received.get(line.id);
      const quantity = input ? Number(input.receivedQuantity) : line.quantity;
      const unitCost = input && input.unitCost !== undefined ? Number(input.unitCost) : line.unitCost;
      if (!Number.isFinite(quantity) || quantity < 0 || quantity > 1e6 || !Number.isFinite(unitCost) || unitCost < 0) return c.json({ success: false, message: 'Enter received quantities and costs of zero or more.' }, 400);
      statements.push(c.env.DB.prepare('UPDATE purchase_order_lines SET received_quantity = ?, unit_cost = ? WHERE id = ?').bind(round(quantity), round(unitCost, 4), line.id));
      if (body.updateCosts !== false && unitCost > 0) statements.push(c.env.DB.prepare('UPDATE stock_items SET unit_cost = ?, total_price = quantity * ?, updated_at = ? WHERE id = ?').bind(round(unitCost, 4), round(unitCost, 4), now, line.stockItemId));
      if (quantity > 0) statements.push(c.env.DB.prepare("INSERT INTO inventory_movements (id, stock_item_id, kind, quantity, notes, created_at) SELECT ?, id, 'purchase', ?, ?, ? FROM stock_items WHERE id = ?")
        .bind(`${id}-${line.stockItemId}`, round(quantity), `Purchase order received${current.supplierName ? ` from ${current.supplierName}` : ''}`.slice(0, 1000), now, line.stockItemId));
    }
    statements.push(c.env.DB.prepare("UPDATE purchase_orders SET status = 'received', received_at = ?, updated_at = ? WHERE id = ?").bind(now, now, id));
    await c.env.DB.batch(statements);
    return c.json({ success: true, data: (await listPurchaseOrders(c.env.DB, id))[0] });
  });

  app.delete('/api/purchase-orders/:id', async c => {
    const id = c.req.param('id');
    const row = await c.env.DB.prepare('SELECT status FROM purchase_orders WHERE id = ?').bind(id).first<Row>();
    if (row && row.status !== 'draft' && row.status !== 'cancelled') return c.json({ success: false, message: 'Only drafts and cancelled orders can be deleted.' }, 409);
    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM purchase_order_lines WHERE purchase_order_id = ?').bind(id),
      c.env.DB.prepare('DELETE FROM purchase_orders WHERE id = ?').bind(id)
    ]);
    return c.json({ success: true });
  });

  // Sends the order text to the café's Telegram chat, ready to forward to the supplier.
  app.post('/api/purchase-orders/:id/telegram', async c => {
    const [po] = await listPurchaseOrders(c.env.DB, c.req.param('id'));
    if (!po) return c.json({ success: false, message: 'Purchase order not found.' }, 404);
    const config = await getTelegramConfig(c.env);
    if (!config.botToken || !config.chatId) return c.json({ success: false, message: 'Connect Telegram in Settings first.' }, 409);
    const text = purchaseOrderText(po, await cafeName(c.env.DB), value => money(config, value));
    const result = await sendTelegramMessage(config.botToken, config.chatId, `📦 <b>Purchase order</b>\n<i>Forward this to ${escapeHtml(po.supplierName || 'the supplier')}.</i>\n\n${escapeHtml(text)}`);
    return result.success ? c.json({ success: true }) : c.json({ success: false, message: result.error || 'Telegram did not accept the message.' }, 502);
  });

  app.get('/api/stock-report', async c => {
    const from = c.req.query('from') || '', to = c.req.query('to') || '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) return c.json({ success: false, message: 'Choose a valid date range.' }, 400);
    if (Date.parse(to) - Date.parse(from) > 366 * 86_400_000) return c.json({ success: false, message: 'Choose at most a year.' }, 400);
    return c.json({ data: { ...await stockReport(c.env.DB, from, to), reasons: WASTE_REASONS.map(r => r.id) } });
  });
}
