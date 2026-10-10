import type { Hono } from 'hono';
import type { Env } from '../server';
import migration from './operationsMigration';
const ready = new WeakMap<object, Promise<void>>();
export function ensureFeatureTables(db: D1Database) {
  let pending = ready.get(db);
  if (!pending) {
    pending = (async () => {
      // SQLite has no ADD COLUMN IF NOT EXISTS; the index lives here too so migration files never reference the column.
      const { results: orderColumns } = await db.prepare('PRAGMA table_info(orders)').all();
      if (!orderColumns.some(column => column.name === 'customer_id')) await db.prepare('ALTER TABLE orders ADD COLUMN customer_id TEXT').run();
      await db.prepare('CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id)').run();
      // Split at statement boundaries, keeping trigger bodies intact.
      const statements = migration.match(/DROP TRIGGER[^;]*;|CREATE TRIGGER[\s\S]*?\nEND;|CREATE (?:TABLE|INDEX)[\s\S]*?;/g) || [];
      for (const sql of statements) {
        // Indexes only speed up reads; a database with older column names still serves requests without them.
        if (sql.startsWith('CREATE INDEX')) await db.prepare(sql).run().catch(error => console.warn('Index skipped:', error));
        else await db.prepare(sql).run();
      }
    })();
    ready.set(db, pending);
    pending.catch(() => ready.delete(db));
  }
  return pending;
}
/** Bumped after every successful write, so clients can skip re-reading data that has not changed. */
export async function dataVersion(db: D1Database) {
  const row = await db.prepare('SELECT version FROM sync_state WHERE id = 1').first<{ version: number }>();
  return row?.version ?? 0;
}
export function bumpDataVersion(db: D1Database) {
  return db.prepare('INSERT INTO sync_state (id, version) VALUES (1, 1) ON CONFLICT(id) DO UPDATE SET version = version + 1').run();
}
export function publicSettings(config: Record<string, unknown>) {
  const keys = ['id','cafeName','logoUrl','brandPrimary','brandSecondary','appearance','currency','taxRate','openHours','timeZone','contactPhone','address','updatedAt'];
  return Object.fromEntries(keys.map(key => [key, config[key]]));
}
export async function trackingToken(id: string, secret?: string) {
  if (!secret) throw new Error('SESSION_SECRET is required for order tracking');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`tracking:${id}`))), byte => byte.toString(16).padStart(2, '0')).join('');
}
/** UTC bounds wide enough to hold every instant of a café date in any time zone. */
export function utcWindow(date: string): [string, string] {
  const day = Date.parse(`${date}T00:00:00.000Z`);
  return [new Date(day - 86_400_000).toISOString(), new Date(day + 2 * 86_400_000).toISOString()];
}
export const cafeDate = (date: Date, timeZone: string) => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
export function registerOperations(app: Hono<Env>) {
  app.get('/api/orders/:id/tracking', async c => {
    const id = c.req.param('id');
    if (!c.env.DB || c.req.query('token') !== await trackingToken(id, c.env.SESSION_SECRET)) return c.json({ message: 'Order not found.' }, 404);
    const order = await c.env.DB.prepare('SELECT order_number, status, total_amount FROM orders WHERE id = ?').bind(id).first();
    if (!order) return c.json({ message: 'Order not found.' }, 404);
    return c.json({ data: order });
  });
  app.get('/api/inventory-movements', async c => {
    const result = await c.env.DB.prepare('SELECT m.*, s.name, s.unit FROM inventory_movements m JOIN stock_items s ON s.id = m.stock_item_id ORDER BY m.created_at DESC LIMIT 200').all();
    return c.json({ data: result.results });
  });
  app.post('/api/inventory-movements', async c => {
    const body = await c.req.json();
    if (!['purchase','waste','adjustment'].includes(body.kind) || !Number.isFinite(body.quantity) || !body.quantity || (body.kind === 'purchase' && body.quantity <= 0) || (body.kind === 'waste' && body.quantity >= 0) || typeof body.notes !== 'string' || !body.notes.trim()) return c.json({ message: 'Enter a valid quantity and reason. Waste must be negative; purchases positive.' }, 400);
    await c.env.DB.prepare('INSERT INTO inventory_movements (id, stock_item_id, kind, quantity, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), body.stockItemId, body.kind, body.quantity, body.notes.slice(0, 1000), new Date().toISOString()).run();
    return c.json({ success: true });
  });
  async function expected(db: D1Database, date: string, openingCash: number) {
    const config = await db.prepare('SELECT time_zone FROM settings WHERE id = ?').bind('cafe_config').first();
    const timeZone = String(config?.time_zone || 'Asia/Tehran');
    const [from, to] = utcWindow(date);
    const orders = (await db.prepare("SELECT * FROM orders WHERE status = 'completed' AND createdAt >= ? AND createdAt < ?").bind(from, to).all()).results.filter(o => cafeDate(new Date(String(o.createdAt)), timeZone) === date);
    const expenses = (await db.prepare("SELECT amount FROM expenses WHERE date = ? AND payment_method = 'cash'").bind(date).all()).results;
    return {
      expectedCash: Number((openingCash + orders.filter(o => o.payment_method === 'cash').reduce((sum, o) => sum + Number(o.total_amount), 0) - expenses.reduce((sum, e) => sum + Number(e.amount), 0)).toFixed(2)),
      expectedCard: Number(orders.filter(o => o.payment_method === 'card').reduce((sum, o) => sum + Number(o.total_amount), 0).toFixed(2))
    };
  }
  app.get('/api/reconciliation', async c => {
    const date = c.req.query('date') || '';
    const opening = Number(c.req.query('openingCash') || 0);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(opening) || opening < 0) return c.json({ message: 'Invalid date or opening cash.' }, 400);
    const saved = await c.env.DB.prepare('SELECT * FROM reconciliations WHERE date = ?').bind(date).first();
    return c.json({ data: { ...await expected(c.env.DB, date, opening), saved } });
  });
  app.post('/api/reconciliation', async c => {
    const b = await c.req.json();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date) || [b.openingCash,b.actualCash,b.actualCard].some(v => !Number.isFinite(v) || v < 0)) return c.json({ message: 'Enter valid nonnegative amounts.' }, 400);
    const totals = await expected(c.env.DB, b.date, b.openingCash);
    await c.env.DB.prepare('INSERT INTO reconciliations (date,opening_cash,expected_cash,expected_card,actual_cash,actual_card,notes,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(date) DO UPDATE SET opening_cash=excluded.opening_cash,expected_cash=excluded.expected_cash,expected_card=excluded.expected_card,actual_cash=excluded.actual_cash,actual_card=excluded.actual_card,notes=excluded.notes,updated_at=excluded.updated_at').bind(b.date,b.openingCash,totals.expectedCash,totals.expectedCard,b.actualCash,b.actualCard,String(b.notes || '').slice(0,1000),new Date().toISOString()).run();
    return c.json({ success: true, data: totals });
  });
}
