import type { Hono } from 'hono';
import type { Env } from '../server';
import { earnsStamps, lineStamps, orderPoints, parseLoyalty, type LoyaltySettings } from '../utils/loyalty';

type Row = Record<string, any>;

export async function loyaltySettings(db: D1Database): Promise<LoyaltySettings> {
  const row = await db.prepare('SELECT loyalty FROM settings WHERE id = ?').bind('cafe_config').first<Row>();
  return parseLoyalty(row?.loyalty);
}

export async function memberBalance(db: D1Database, customerId: string) {
  const row = await db.prepare('SELECT COALESCE(SUM(stamps), 0) AS stamps, COALESCE(SUM(points), 0) AS points FROM customer_ledger WHERE customer_id = ?').bind(customerId).first<Row>();
  return { stamps: Number(row?.stamps || 0), points: Number(row?.points || 0) };
}

/** What a completed order earns its member under the current rules. */
async function orderEarnings(db: D1Database, order: Row, settings: LoyaltySettings) {
  const { results: lines } = await db.prepare(
    'SELECT oi.quantity, oi.unit_price, oi.item_total, m.category_id FROM order_items oi LEFT JOIN menu_items m ON m.id = oi.menu_item_id WHERE oi.order_id = ?'
  ).bind(order.id).all<Row>();
  const stamps = lines.reduce((sum, line) => sum + (earnsStamps(settings, line.category_id) ? lineStamps({ quantity: Number(line.quantity), unitPrice: Number(line.unit_price), itemTotal: Number(line.item_total) }) : 0), 0);
  return { stamps, points: orderPoints(settings, Number(order.total_amount)) };
}

/**
 * Brings an order's club entries in line with the order: it earns once it is completed, and whatever it redeemed
 * goes back to the member when it is cancelled, deleted or unlinked. Safe to call after any change to the order.
 */
export async function syncOrderLoyalty(db: D1Database, orderId: string) {
  const order = await db.prepare('SELECT id, customer_id, status, total_amount, createdAt FROM orders WHERE id = ?').bind(orderId).first<Row>();
  const statements = [db.prepare("DELETE FROM customer_ledger WHERE order_id = ? AND kind = 'earn'").bind(orderId)];
  if (!order || !order.customer_id || order.status === 'cancelled') {
    statements.push(db.prepare("DELETE FROM customer_ledger WHERE order_id = ? AND kind = 'redeem'").bind(orderId));
  } else {
    statements.push(db.prepare("UPDATE customer_ledger SET customer_id = ? WHERE order_id = ? AND kind = 'redeem'").bind(order.customer_id, orderId));
    const settings = await loyaltySettings(db);
    if (order.status === 'completed' && settings.enabled) {
      const earned = await orderEarnings(db, order, settings);
      if (earned.stamps || earned.points) {
        statements.push(db.prepare("INSERT INTO customer_ledger (id, customer_id, order_id, kind, stamps, points, note, created_at) VALUES (?, ?, ?, 'earn', ?, ?, '', ?)")
          .bind(`earn-${orderId}`, order.customer_id, orderId, earned.stamps, earned.points, new Date().toISOString()));
      }
    }
  }
  await db.batch(statements);
}

/** Checks a redemption against the member's balance and the rules; returns the ledger insert or an error message. */
export async function redemptionStatement(db: D1Database, orderId: string, customerId: string | null, input: unknown): Promise<{ statement: D1PreparedStatement | null; minimumDiscount: number } | { error: string }> {
  if (input === undefined || input === null) return { statement: null, minimumDiscount: 0 };
  const stamps = Math.round(Number((input as Row).stamps || 0));
  const points = Math.round(Number((input as Row).points || 0));
  if (!stamps && !points) return { statement: null, minimumDiscount: 0 };
  if (!customerId) return { error: 'Pick the club member before using their stamps or points.' };
  if (!Number.isInteger(stamps) || !Number.isInteger(points) || stamps < 0 || points < 0) return { error: 'Invalid club redemption.' };
  const settings = await loyaltySettings(db);
  if (!settings.enabled) return { error: 'The club rewards are switched off.' };
  if (stamps && (!settings.stampsPerReward || stamps % settings.stampsPerReward)) return { error: 'Stamps are redeemed a full card at a time.' };
  if (points && !(settings.spendPerPoint > 0 && settings.pointValue > 0)) return { error: 'Points are switched off.' };
  const balance = await memberBalance(db, customerId);
  if (stamps > balance.stamps || points > balance.points) return { error: 'The member does not have enough stamps or points for this.' };
  return {
    statement: db.prepare("INSERT INTO customer_ledger (id, customer_id, order_id, kind, stamps, points, note, created_at) VALUES (?, ?, ?, 'redeem', ?, ?, '', ?)")
      .bind(`redeem-${orderId}`, customerId, orderId, -stamps, -points, new Date().toISOString()),
    minimumDiscount: Number((points * settings.pointValue).toFixed(2))
  };
}

export function registerLoyalty(app: Hono<Env>) {
  app.get('/api/customers/:id/ledger', async c => {
    const { results } = await c.env.DB.prepare(
      'SELECT l.id, l.order_id AS orderId, l.kind, l.stamps, l.points, l.note, l.created_at AS createdAt, o.order_number AS orderNumber FROM customer_ledger l LEFT JOIN orders o ON o.id = l.order_id WHERE l.customer_id = ? ORDER BY l.created_at DESC LIMIT 100'
    ).bind(c.req.param('id')).all();
    return c.json({ data: results, balance: await memberBalance(c.env.DB, c.req.param('id')) });
  });

  // The admin corrects a balance by hand, with a reason, for a lost card or a goodwill stamp.
  app.post('/api/customers/:id/ledger', async c => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const stamps = Number(body.stamps || 0), points = Number(body.points || 0);
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 200) : '';
    if (!Number.isInteger(stamps) || !Number.isInteger(points) || (!stamps && !points) || Math.abs(stamps) > 1000 || Math.abs(points) > 1e7 || !note) {
      return c.json({ success: false, message: 'Enter whole stamps or points to add or take away, and a reason.' }, 400);
    }
    if (!await c.env.DB.prepare('SELECT id FROM customers WHERE id = ?').bind(id).first()) return c.json({ success: false, message: 'Member not found.' }, 404);
    const balance = await memberBalance(c.env.DB, id);
    if (balance.stamps + stamps < 0 || balance.points + points < 0) return c.json({ success: false, message: 'A balance cannot go below zero.' }, 400);
    await c.env.DB.prepare("INSERT INTO customer_ledger (id, customer_id, order_id, kind, stamps, points, note, created_at) VALUES (?, ?, NULL, 'adjust', ?, ?, ?, ?)")
      .bind(`adj-${crypto.randomUUID()}`, id, stamps, points, note, new Date().toISOString()).run();
    return c.json({ success: true, balance: await memberBalance(c.env.DB, id) });
  });
}
