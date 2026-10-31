// The CHTH hub (the owner's private admin bot): the control plane reports landing visits that
// came from other CHTH products (?ref=), sign-ins and deploys, and answers signed
// GET /internal/stats. Set HUB_URL and HUB_SECRET to switch it on; without them nothing is
// sent and /internal/stats refuses every call. Only counts leave: no account names or tokens.

import type { Context } from 'hono';
import { createReporter, verifySigned } from '../../src/chth-kit/hub.js';
import type { Bindings } from './shared';

export function track(c: Context<{ Bindings: Bindings } & any>, type: string, data: Record<string, unknown> = {}, user?: string) {
  const reporter = createReporter({ url: c.env.HUB_URL, secret: c.env.HUB_SECRET, source: 'cafe' });
  if (!reporter.enabled) return;
  const sent = reporter.track(type, data, user);
  try { c.executionCtx.waitUntil(sent); } catch { /* no execution context in tests */ }
}

export async function hubStats(c: Context<{ Bindings: Bindings } & any>): Promise<Response> {
  const secret = c.env.HUB_SECRET;
  const ok = secret ? await verifySigned(c.req.raw, s => (s === 'hub' ? secret : null)) : null;
  if (!ok) return c.json({ ok: false, error: 'forbidden' }, 403);
  const db = c.env.DB as D1Database;
  const one = async (sql: string) => (await db.prepare(sql).first<{ n: number }>())?.n ?? 0;
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
  const [cafes, live, failed, owners, deploys7d, failed7d] = await Promise.all([
    one('SELECT COUNT(*) AS n FROM cafes'),
    one("SELECT COUNT(*) AS n FROM cafes WHERE status = 'live'"),
    one("SELECT COUNT(*) AS n FROM cafes WHERE status = 'failed'"),
    one('SELECT COUNT(*) AS n FROM connections'),
    db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action IN ('deploy', 'update') AND created_at >= ?").bind(weekAgo).first<{ n: number }>().then(r => r?.n ?? 0),
    db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'deploy-failed' AND created_at >= ?").bind(weekAgo).first<{ n: number }>().then(r => r?.n ?? 0),
  ]);
  const versions = (await db.prepare('SELECT version, COUNT(*) AS n FROM cafes WHERE version IS NOT NULL GROUP BY version ORDER BY n DESC LIMIT 5').all<{ version: string; n: number }>()).results ?? [];
  return c.json({ cafes, live, failed, owners, deploys7d, failed7d, versions: Object.fromEntries(versions.map(v => [v.version, v.n])) });
}
