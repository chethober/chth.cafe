import type { Hono } from 'hono';
import type { Env } from '../server';
import { parsePickupSlots, pickupSlotTimes } from '../utils/pickupSlots';

type Row = Record<string, any>;

/** Today's remaining pickup slots with the orders each can still take. */
export async function availablePickupSlots(db: D1Database, config: Row, now = new Date()) {
  const settings = parsePickupSlots(config.pickup_slots ?? config.pickupSlots);
  const times = pickupSlotTimes(String(config.open_hours ?? config.openHours ?? ''), String(config.time_zone ?? config.timeZone ?? 'Asia/Tehran'), settings, now);
  if (!times.length) return { settings, slots: [] as Array<{ at: string; label: string; remaining: number }> };
  const { results } = await db.prepare("SELECT pickup_at, COUNT(*) AS n FROM orders WHERE pickup_at >= ? AND pickup_at <= ? AND status != 'cancelled' GROUP BY pickup_at")
    .bind(times[0].at, times[times.length - 1].at).all<Row>();
  const taken = new Map(results.map(r => [String(r.pickup_at), Number(r.n)]));
  return { settings, slots: times.map(slot => ({ ...slot, remaining: Math.max(0, settings.capacity - (taken.get(slot.at) || 0)) })) };
}

export function registerPickup(app: Hono<Env>) {
  app.get('/api/pickup-slots', async c => {
    const config = await c.env.DB.prepare('SELECT open_hours, time_zone, pickup_slots FROM settings WHERE id = ?').bind('cafe_config').first<Row>();
    if (!config) return c.json({ data: { enabled: false, slots: [] } });
    const { settings, slots } = await availablePickupSlots(c.env.DB, config);
    return c.json({ data: { enabled: settings.enabled, slots } });
  });
}
