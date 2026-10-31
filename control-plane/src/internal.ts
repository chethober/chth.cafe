import { Hono, type Context } from 'hono';
import { verifySigned } from '../../src/chth-kit/hub.js';
import { deleteCafe } from './cloudflare';
import { decrypt } from './crypto';
import { revoke, type Credentials } from './oauth';
import { audit, clientFor, currentRelease, deployRow, ensureSchema, message, now, resourcesOf, type Bindings, type CafeRow, type ConnectionRow } from './shared';

/**
 * The platform admin, for the CHTH hub's admin bot only: every request must be signed with
 * HUB_SECRET (see src/chth-kit/hub.js), and without that secret everything here is refused.
 * There is no admin website. Actions go to the owner's audit_log as `admin:<action>`.
 *
 *   GET  /internal/stats                    counts for the hub's dashboard
 *   GET  /internal/cafes                    accounts and their cafés, the release, the notice
 *   GET  /internal/cafes/:id                one café with its recent history
 *   POST /internal/cafes/:id/rename         { name }
 *   POST /internal/cafes/:id/deploy         update to the latest release with the owner's access
 *   POST /internal/cafes/:id/notice         { mode: 'global' | 'none' | 'custom', text?, url? }
 *   POST /internal/cafes/:id/forget         remove from the platform; it keeps running
 *   POST /internal/cafes/:id/delete         { confirm: <worker name> } delete from Cloudflare
 *   POST /internal/notice                   { text, url? } the global notice; empty text clears it
 *   POST /internal/accounts/:id/remove      revoke access, sign out, forget its cafés
 */
type Env = { Bindings: Bindings; Variables: { body: Record<string, unknown> } };
type C = Context<Env>;

const NOTICE_MAX = 200;
const internal = new Hono<Env>();

internal.use('*', async (c, next) => {
  const secret = c.env.HUB_SECRET;
  const ok = secret ? await verifySigned(c.req.raw, source => (source === 'hub' ? secret : null)) : null;
  if (!ok) return c.json({ ok: false, error: 'forbidden' }, 403);
  try {
    c.set('body', ok.body ? JSON.parse(ok.body) : {});
  } catch {
    return c.json({ ok: false, error: 'body is not JSON' }, 400);
  }
  await ensureSchema(c.env.DB);
  await next();
});

const fail = (c: C, error: string, status: 400 | 404 | 409 | 502 = 400) => c.json({ ok: false, error }, status);
const log = (c: C, ownerId: string, action: string, detail = '', cafeId: string | null = null) => audit(c.env.DB, ownerId, `admin:${action}`, detail, cafeId);
const cafeOf = (c: C) => c.env.DB.prepare('SELECT * FROM cafes WHERE id = ?').bind(c.req.param('id')).first<CafeRow>();
const connectionOf = (c: C, ownerId: string) => c.env.DB.prepare('SELECT * FROM connections WHERE owner_id = ?').bind(ownerId).first<ConnectionRow>();
type NoticeRow = { scope: string; text: string; url: string | null };
const noticeOf = (c: C, scope: string) => c.env.DB.prepare('SELECT scope, text, url FROM notices WHERE scope = ?').bind(scope).first<NoticeRow>();
const upsertNotice = (c: C, scope: string, text: string, url: string | null) =>
  c.env.DB.prepare('INSERT INTO notices (scope, text, url, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(scope) DO UPDATE SET text = excluded.text, url = excluded.url, updated_at = excluded.updated_at')
    .bind(scope, text, url, now()).run();

/** Checks a notice line: plain text, and an optional https link. */
function readNotice(body: Record<string, unknown>) {
  const text = String(body.text ?? '').replace(/\s+/g, ' ').trim();
  const url = String(body.url ?? '').trim();
  if (text.length > NOTICE_MAX) return { error: `Keep the notice to ${NOTICE_MAX} characters.` };
  if (url) {
    try { if (new URL(url).protocol !== 'https:') throw new Error(); } catch { return { error: 'The link must be a full https:// address.' }; }
  }
  return { text, url: url || null };
}

const cafeSummary = (cafe: CafeRow, connection: ConnectionRow | null | undefined, noticeScopes: Map<string, string>) => ({
  id: cafe.id, name: cafe.name, worker: cafe.script_name, status: cafe.status, version: cafe.version,
  url: cafe.url, customDomain: cafe.custom_domain, lastError: cafe.last_error, createdAt: cafe.created_at,
  ownerId: cafe.owner_id, reachable: connection?.account_id === cafe.account_id,
  notice: noticeScopes.has(cafe.id) ? (noticeScopes.get(cafe.id) ? 'custom' : 'none') : 'global',
});

internal.get('/internal/stats', async c => {
  const db = c.env.DB;
  const one = async (sql: string, ...args: unknown[]) => (await db.prepare(sql).bind(...args).first<{ n: number }>())?.n ?? 0;
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
  const [cafes, live, failed, owners, deploys7d, failed7d, release] = await Promise.all([
    one('SELECT COUNT(*) AS n FROM cafes'),
    one("SELECT COUNT(*) AS n FROM cafes WHERE status = 'live'"),
    one("SELECT COUNT(*) AS n FROM cafes WHERE status = 'failed'"),
    one('SELECT COUNT(*) AS n FROM connections'),
    one("SELECT COUNT(*) AS n FROM audit_log WHERE action IN ('deploy', 'update', 'admin:update') AND created_at >= ?", weekAgo),
    one("SELECT COUNT(*) AS n FROM audit_log WHERE action IN ('deploy-failed', 'admin:deploy-failed') AND created_at >= ?", weekAgo),
    currentRelease(c.env).catch(() => null),
  ]);
  const versions = (await db.prepare('SELECT version, COUNT(*) AS n FROM cafes WHERE version IS NOT NULL GROUP BY version ORDER BY n DESC LIMIT 5').all<{ version: string; n: number }>()).results ?? [];
  return c.json({ cafes, live, failed, owners, deploys7d, failed7d, latest: release?.version ?? null, versions: Object.fromEntries(versions.map(v => [v.version, v.n])) });
});

internal.get('/internal/cafes', async c => {
  const [release, connections, cafes, notice, overrides] = await Promise.all([
    currentRelease(c.env).catch(() => null),
    c.env.DB.prepare('SELECT * FROM connections ORDER BY created_at').all<ConnectionRow>(),
    c.env.DB.prepare('SELECT * FROM cafes ORDER BY created_at').all<CafeRow>(),
    noticeOf(c, 'global'),
    c.env.DB.prepare("SELECT scope, text FROM notices WHERE scope != 'global'").all<{ scope: string; text: string }>(),
  ]);
  const scopes = new Map(overrides.results.map(row => [row.scope, row.text]));
  const byOwner = new Map(connections.results.map(row => [row.owner_id, row]));
  // Cafés stay listed under an account that disconnected, until they are removed.
  const accounts = new Map(connections.results.map(row => [row.owner_id, { id: row.owner_id, name: row.account_name, method: row.method as string | null, connectedAt: row.created_at, cafes: [] as ReturnType<typeof cafeSummary>[] }]));
  for (const cafe of cafes.results) {
    if (!accounts.has(cafe.owner_id)) accounts.set(cafe.owner_id, { id: cafe.owner_id, name: 'Disconnected account', method: null, connectedAt: cafe.created_at, cafes: [] });
    accounts.get(cafe.owner_id)!.cafes.push(cafeSummary(cafe, byOwner.get(cafe.owner_id), scopes));
  }
  return c.json({ latest: release?.version ?? null, notice: notice && { text: notice.text, url: notice.url }, accounts: [...accounts.values()] });
});

internal.get('/internal/cafes/:id', async c => {
  const cafe = await cafeOf(c);
  if (!cafe) return fail(c, 'café not found', 404);
  const [release, connection, notice, history] = await Promise.all([
    currentRelease(c.env).catch(() => null),
    connectionOf(c, cafe.owner_id),
    noticeOf(c, cafe.id),
    c.env.DB.prepare('SELECT action, detail, created_at FROM audit_log WHERE cafe_id = ? ORDER BY id DESC LIMIT 10').bind(cafe.id).all<{ action: string; detail: string; created_at: string }>(),
  ]);
  const scopes = new Map(notice ? [[cafe.id, notice.text]] : []);
  return c.json({
    latest: release?.version ?? null,
    cafe: { ...cafeSummary(cafe, connection, scopes), ownerName: connection?.account_name ?? null, customNotice: notice && notice.text ? { text: notice.text, url: notice.url } : null },
    history: history.results,
  });
});

internal.post('/internal/cafes/:id/rename', async c => {
  const cafe = await cafeOf(c);
  if (!cafe) return fail(c, 'café not found', 404);
  const name = String(c.get('body').name ?? '').trim();
  if (!name || name.length > 100) return fail(c, 'Enter a café name up to 100 characters.');
  await c.env.DB.prepare('UPDATE cafes SET name = ?, updated_at = ? WHERE id = ?').bind(name, now(), cafe.id).run();
  await log(c, cafe.owner_id, 'rename', `${cafe.name} → ${name}`, cafe.id);
  return c.json({ ok: true });
});

/** Deploys the latest release with the owner's saved access, keeping the café's data and secrets. */
internal.post('/internal/cafes/:id/deploy', async c => {
  const cafe = await cafeOf(c);
  if (!cafe) return fail(c, 'café not found', 404);
  const connection = await connectionOf(c, cafe.owner_id);
  if (!connection || connection.account_id !== cafe.account_id) return fail(c, 'The owner’s saved access does not reach this café’s account.', 409);
  try {
    const result = await deployRow(c.env, c.req.url, cafe, connection);
    await log(c, cafe.owner_id, 'update', result.version, cafe.id);
    return c.json({ ok: true, version: result.version });
  } catch (error) {
    await log(c, cafe.owner_id, 'deploy-failed', message(error), cafe.id);
    return fail(c, message(error), 502);
  }
});

/** A café shows the global notice, its own, or none. */
internal.post('/internal/cafes/:id/notice', async c => {
  const cafe = await cafeOf(c);
  if (!cafe) return fail(c, 'café not found', 404);
  const body = c.get('body');
  if (body.mode === 'global') {
    await c.env.DB.prepare('DELETE FROM notices WHERE scope = ?').bind(cafe.id).run();
  } else if (body.mode === 'none') {
    await upsertNotice(c, cafe.id, '', null);
  } else if (body.mode === 'custom') {
    const notice = readNotice(body);
    if ('error' in notice) return fail(c, notice.error!);
    if (!notice.text) return fail(c, 'Write the café’s own notice, or choose to show none.');
    await upsertNotice(c, cafe.id, notice.text, notice.url);
  } else {
    return fail(c, 'mode must be global, none or custom');
  }
  await log(c, cafe.owner_id, 'notice', String(body.mode), cafe.id);
  return c.json({ ok: true });
});

internal.post('/internal/cafes/:id/forget', async c => {
  const cafe = await cafeOf(c);
  if (!cafe) return fail(c, 'café not found', 404);
  await c.env.DB.batch([c.env.DB.prepare('DELETE FROM cafes WHERE id = ?').bind(cafe.id), c.env.DB.prepare('DELETE FROM notices WHERE scope = ?').bind(cafe.id)]);
  await log(c, cafe.owner_id, 'forget', cafe.script_name, cafe.id);
  return c.json({ ok: true });
});

internal.post('/internal/cafes/:id/delete', async c => {
  const cafe = await cafeOf(c);
  if (!cafe) return fail(c, 'café not found', 404);
  if (String(c.get('body').confirm ?? '').trim() !== cafe.script_name) return fail(c, 'The Worker name does not match. Nothing was deleted.');
  const connection = await connectionOf(c, cafe.owner_id);
  if (!connection || connection.account_id !== cafe.account_id) return fail(c, 'The owner’s saved access does not reach this café’s account. Remove it from the platform instead.', 409);
  try { await deleteCafe(await clientFor(c.env, connection), resourcesOf(cafe)); } catch (error) { return fail(c, message(error), 502); }
  await c.env.DB.batch([c.env.DB.prepare('DELETE FROM cafes WHERE id = ?').bind(cafe.id), c.env.DB.prepare('DELETE FROM notices WHERE scope = ?').bind(cafe.id)]);
  await log(c, cafe.owner_id, 'delete', cafe.script_name, cafe.id);
  return c.json({ ok: true });
});

internal.post('/internal/notice', async c => {
  const notice = readNotice(c.get('body'));
  if ('error' in notice) return fail(c, notice.error!);
  if (notice.text) await upsertNotice(c, 'global', notice.text, notice.url);
  else await c.env.DB.prepare("DELETE FROM notices WHERE scope = 'global'").run();
  return c.json({ ok: true });
});

/** Revokes the account's access, signs it out everywhere and forgets its cafés. The cafés keep running in its account. */
internal.post('/internal/accounts/:id/remove', async c => {
  const id = c.req.param('id');
  const connection = await connectionOf(c, id);
  const cafes = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM cafes WHERE owner_id = ?').bind(id).first<{ n: number }>();
  if (!connection && !cafes?.n) return fail(c, 'account not found', 404);
  if (connection) await revoke(c.env, await decrypt<Credentials>(c.env.ENCRYPTION_KEY, id, connection.credentials).catch(() => ({ kind: 'token', token: '' }) as Credentials));
  const db = c.env.DB;
  await db.batch([
    db.prepare('DELETE FROM notices WHERE scope IN (SELECT id FROM cafes WHERE owner_id = ?)').bind(id),
    db.prepare('DELETE FROM cafes WHERE owner_id = ?').bind(id),
    db.prepare('DELETE FROM sessions WHERE owner_id = ?').bind(id),
    db.prepare('DELETE FROM connections WHERE owner_id = ?').bind(id),
  ]);
  await log(c, id, 'remove-account', connection?.account_name ?? '');
  return c.json({ ok: true });
});

internal.notFound(c => c.json({ ok: false, error: 'not found' }, 404));
internal.onError((error, c) => {
  console.error('Internal request failed', error);
  return c.json({ ok: false, error: 'internal error' }, 500);
});

export default internal;
