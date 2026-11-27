import type { Hono } from 'hono';
import type { Env } from '../server';
import { normalizePromotion, promotionError, type Promotion } from '../utils/promotions';

/** Promotions switched on, for pricing orders and showing on the menu. */
export async function activePromotions(db: D1Database): Promise<Promotion[]> {
  const { results } = await db.prepare('SELECT * FROM promotions WHERE active = 1').all<Record<string, unknown>>();
  return results.map(normalizePromotion);
}

const bind = (p: Promotion) => [p.name, p.kind, p.value, JSON.stringify(p.categoryIds), JSON.stringify(p.itemIds), JSON.stringify(p.days), p.startTime, p.endTime, p.startsOn, p.endsOn, p.active ? 1 : 0];

export function registerPromotions(app: Hono<Env>) {
  // Everyone reads promotions: the public menu shows happy-hour prices, the till applies them. The admin also sees ones switched off.
  app.get('/api/promotions', async c => {
    const admin = c.get('authed') && c.get('workspace') === 'admin';
    const { results } = await c.env.DB.prepare(`SELECT * FROM promotions ${admin ? '' : 'WHERE active = 1'} ORDER BY created_at`).all<Record<string, unknown>>();
    return c.json({ data: results.map(normalizePromotion) });
  });

  app.post('/api/promotions', async c => {
    const body = await c.req.json();
    const now = new Date().toISOString();
    const promotion = normalizePromotion({ ...body, id: `promo-${crypto.randomUUID()}`, active: body.active !== false, createdAt: now, updatedAt: now });
    const error = promotionError(promotion);
    if (error) return c.json({ success: false, message: error }, 400);
    await c.env.DB.prepare('INSERT INTO promotions (name, kind, value, category_ids, item_ids, days, start_time, end_time, starts_on, ends_on, active, id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(...bind(promotion), promotion.id, now, now).run();
    return c.json({ success: true, data: promotion });
  });

  app.put('/api/promotions/:id', async c => {
    const id = c.req.param('id');
    const row = await c.env.DB.prepare('SELECT * FROM promotions WHERE id = ?').bind(id).first<Record<string, unknown>>();
    if (!row) return c.json({ success: false, message: 'Promotion not found.' }, 404);
    const body = await c.req.json();
    const current = normalizePromotion(row);
    const promotion = normalizePromotion({ ...current, ...body, id, createdAt: current.createdAt, updatedAt: new Date().toISOString() });
    const error = promotionError(promotion);
    if (error) return c.json({ success: false, message: error }, 400);
    await c.env.DB.prepare('UPDATE promotions SET name = ?, kind = ?, value = ?, category_ids = ?, item_ids = ?, days = ?, start_time = ?, end_time = ?, starts_on = ?, ends_on = ?, active = ?, updated_at = ? WHERE id = ?')
      .bind(...bind(promotion), promotion.updatedAt, id).run();
    return c.json({ success: true, data: promotion });
  });

  app.delete('/api/promotions/:id', async c => {
    await c.env.DB.prepare('DELETE FROM promotions WHERE id = ?').bind(c.req.param('id')).run();
    return c.json({ success: true });
  });
}
