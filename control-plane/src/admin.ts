import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { safeEqual } from '../../src/utils/passwords';
import { deleteCafe } from './cloudflare';
import { decrypt, randomToken, sha256 } from './crypto';
import { FAVICON, THEME_COOKIE, THEME_SWITCH_COOKIE } from './design';
import { revoke, type Credentials } from './oauth';
import { attempts, audit, clientFor, currentRelease, deployRow, guarded, message, now, resourcesOf, themed, type Bindings, type CafeRow, type ConnectionRow } from './shared';
import * as views from './admin-views';

/**
 * The platform admin, served on admin.<control plane host>. One password, which every
 * `npm run deploy:control-plane` replaces; a new password also ends every admin session.
 */
type Env = { Bindings: Bindings; Variables: { session: string | null } };
type C = Context<Env>;

const COOKIE = 'cp_admin';
const SESSION_HOURS = 12;
const NOTICE_MAX = 200;

const hex = async (text: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(b => b.toString(16).padStart(2, '0')).join('');
const csrfFor = (session: string) => sha256(`admin-csrf:${session}`);
const csrf = (c: C) => csrfFor(c.get('session')!);
/** Admin actions are written to the owner's audit log, marked as the platform's. */
const log = (c: C, ownerId: string, action: string, detail = '', cafeId: string | null = null) => audit(c.env.DB, ownerId, `admin:${action}`, detail, cafeId);

const FLASH: Record<string, string> = {
  notice: 'Notice saved. Cafés pick it up within about ten minutes.',
  saved: 'Café saved.',
  updated: 'Café updated to the latest release.',
  forgotten: 'The café was removed from the platform. It keeps running in its owner’s account.',
  deleted: 'The café and its data were deleted from its owner’s Cloudflare account.',
  removed: 'The account was removed from the platform and its Cloudflare access revoked. Its cafés keep running.'
};

const admin = new Hono<Env>();
admin.use('*', themed, guarded);

admin.get('/favicon.svg', c => c.body(FAVICON, 200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' }));
admin.get('/favicon.ico', c => c.body(FAVICON, 200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' }));

admin.post('/theme', async c => {
  const form = await c.req.parseBody();
  const secure = new URL(c.req.url).protocol === 'https:';
  setCookie(c, THEME_COOKIE, form.theme === 'light' ? 'light' : 'dark', { secure, sameSite: 'Lax', path: '/', maxAge: 365 * 86400 });
  setCookie(c, THEME_SWITCH_COOKIE, '1', { secure, sameSite: 'Lax', path: '/', maxAge: 30 });
  let back = '/';
  try {
    const referer = new URL(c.req.header('Referer') || '');
    if (referer.origin === new URL(c.req.url).origin && /^\/(?:(?:cafes|accounts)\/[\w-]+)?$/.test(referer.pathname)) back = referer.pathname;
  } catch { /* no referer: go home */ }
  return c.redirect(back, 303);
});

admin.use('*', async (c, next) => {
  const expected = c.env.ADMIN_PASSWORD_HASH?.trim().toLowerCase();
  if (!expected) return c.html(views.notConfigured(), 503);
  const token = getCookie(c, COOKIE);
  let session: string | null = null;
  if (token) {
    // Sessions belong to the password they signed in with, so a deploy with a new password ends them.
    const row = await c.env.DB.prepare('SELECT password_hash FROM admin_sessions WHERE id_hash = ? AND expires_at > ?').bind(await sha256(token), Date.now()).first<{ password_hash: string }>();
    if (row && row.password_hash === expected) session = token;
  }
  c.set('session', session);
  if (c.req.path === '/login') return next();
  if (!session) return c.req.method === 'GET' && c.req.path === '/' ? c.html(views.signIn({})) : c.redirect('/', 303);
  if (c.req.method === 'POST') {
    const form = await c.req.parseBody();
    if (typeof form.csrf !== 'string' || !(await safeEqual(form.csrf, await csrfFor(session)))) return c.html(views.errorPage('This form expired. Go back, reload the page and try again.'), 403);
  }
  await next();
});

admin.post('/login', async c => {
  const limit = await attempts(c, 'admin');
  if (limit.blocked) return c.html(views.signIn({ error: 'Too many attempts. Try again in 15 minutes.' }), 429);
  const form = await c.req.parseBody();
  const password = String(form.password || '');
  if (!password || !(await safeEqual(await hex(password), c.env.ADMIN_PASSWORD_HASH!.trim().toLowerCase()))) {
    await limit.fail();
    return c.html(views.signIn({ error: 'That is not the current admin password. Every deploy prints a new one.' }), 400);
  }
  await limit.clear();
  const token = randomToken();
  await c.env.DB.prepare('DELETE FROM admin_sessions WHERE expires_at < ? OR password_hash != ?').bind(Date.now(), c.env.ADMIN_PASSWORD_HASH!.trim().toLowerCase()).run();
  await c.env.DB.prepare('INSERT INTO admin_sessions (id_hash, password_hash, expires_at) VALUES (?, ?, ?)').bind(await sha256(token), c.env.ADMIN_PASSWORD_HASH!.trim().toLowerCase(), Date.now() + SESSION_HOURS * 3600000).run();
  setCookie(c, COOKIE, token, { httpOnly: true, secure: new URL(c.req.url).protocol === 'https:', sameSite: 'Strict', path: '/', maxAge: SESSION_HOURS * 3600 });
  return c.redirect('/', 303);
});

admin.post('/signout', async c => {
  await c.env.DB.prepare('DELETE FROM admin_sessions WHERE id_hash = ?').bind(await sha256(c.get('session')!)).run();
  deleteCookie(c, COOKIE, { path: '/' });
  return c.redirect('/', 303);
});

type NoticeRow = { scope: string; text: string; url: string | null };
const noticeOf = (c: C, scope: string) => c.env.DB.prepare('SELECT scope, text, url FROM notices WHERE scope = ?').bind(scope).first<NoticeRow>();

admin.get('/', async c => {
  const [release, connections, cafes, notice, overrides] = await Promise.all([
    currentRelease(c.env),
    c.env.DB.prepare('SELECT * FROM connections ORDER BY created_at').all<ConnectionRow>(),
    c.env.DB.prepare('SELECT * FROM cafes ORDER BY created_at').all<CafeRow>(),
    noticeOf(c, 'global'),
    c.env.DB.prepare("SELECT scope FROM notices WHERE scope != 'global'").all<{ scope: string }>()
  ]);
  // Cafés stay listed under an account that disconnected, until they are removed here.
  const owners = new Map(connections.results.map(row => [row.owner_id, { id: row.owner_id, name: row.account_name, method: row.method as string | null, connectedAt: row.created_at, cafes: [] as CafeRow[] }]));
  for (const cafe of cafes.results) {
    if (!owners.has(cafe.owner_id)) owners.set(cafe.owner_id, { id: cafe.owner_id, name: 'Disconnected account', method: null, connectedAt: cafe.created_at, cafes: [] });
    owners.get(cafe.owner_id)!.cafes.push(cafe);
  }
  return c.html(views.overview({
    csrf: await csrf(c), currentVersion: release.version, message: FLASH[c.req.query('done') || ''],
    notice: notice && { text: notice.text, url: notice.url }, customNotices: new Set(overrides.results.map(r => r.scope)),
    accounts: [...owners.values()], cafeCount: cafes.results.length, liveCount: cafes.results.filter(cafe => cafe.status === 'live').length
  }));
});

/** Checks a notice line: plain text, and an optional https link. */
function readNotice(form: Record<string, unknown>) {
  const text = String(form.text || '').replace(/\s+/g, ' ').trim();
  const url = String(form.url || '').trim();
  if (text.length > NOTICE_MAX) return { error: `Keep the notice to ${NOTICE_MAX} characters.` };
  if (url) {
    try { if (new URL(url).protocol !== 'https:') throw new Error(); } catch { return { error: 'The link must be a full https:// address.' }; }
  }
  return { text, url: url || null };
}

admin.post('/notice', async c => {
  const notice = readNotice(await c.req.parseBody());
  if ('error' in notice) return c.html(views.errorPage(notice.error!), 400);
  if (notice.text) await c.env.DB.prepare('INSERT INTO notices (scope, text, url, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(scope) DO UPDATE SET text = excluded.text, url = excluded.url, updated_at = excluded.updated_at').bind('global', notice.text, notice.url, now()).run();
  else await c.env.DB.prepare("DELETE FROM notices WHERE scope = 'global'").run();
  return c.redirect('/?done=notice', 303);
});

async function cafeOf(c: C) {
  return c.env.DB.prepare('SELECT * FROM cafes WHERE id = ?').bind(c.req.param('id')).first<CafeRow>();
}

const cafePage = async (c: C, cafe: CafeRow, error?: string, status: 200 | 400 | 409 | 502 = 200) => {
  const [release, connection, notice, global, history] = await Promise.all([
    currentRelease(c.env),
    c.env.DB.prepare('SELECT * FROM connections WHERE owner_id = ?').bind(cafe.owner_id).first<ConnectionRow>(),
    noticeOf(c, cafe.id),
    noticeOf(c, 'global'),
    c.env.DB.prepare('SELECT action, detail, created_at FROM audit_log WHERE cafe_id = ? ORDER BY id DESC LIMIT 30').bind(cafe.id).all<{ action: string; detail: string; created_at: string }>()
  ]);
  return c.html(views.cafe({
    csrf: await csrf(c), cafe, currentVersion: release.version, error, message: FLASH[c.req.query('done') || ''],
    owner: { id: cafe.owner_id, name: connection?.account_name ?? null, reachable: connection?.account_id === cafe.account_id },
    notice: notice && { text: notice.text, url: notice.url }, globalNotice: global && { text: global.text, url: global.url },
    history: history.results
  }), status);
};

admin.get('/cafes/:id', async c => {
  const cafe = await cafeOf(c);
  return cafe ? cafePage(c, cafe) : c.html(views.errorPage('That café was not found.'), 404);
});

admin.post('/cafes/:id', async c => {
  const cafe = await cafeOf(c);
  if (!cafe) return c.html(views.errorPage('That café was not found.'), 404);
  const name = String((await c.req.parseBody()).name || '').trim();
  if (!name || name.length > 100) return cafePage(c, cafe, 'Enter a café name up to 100 characters.', 400);
  await c.env.DB.prepare('UPDATE cafes SET name = ?, updated_at = ? WHERE id = ?').bind(name, now(), cafe.id).run();
  await log(c, cafe.owner_id, 'rename', `${cafe.name} → ${name}`, cafe.id);
  return c.redirect(`/cafes/${cafe.id}?done=saved`, 303);
});

/** A café shows the global notice, its own, or none. */
admin.post('/cafes/:id/notice', async c => {
  const cafe = await cafeOf(c);
  if (!cafe) return c.html(views.errorPage('That café was not found.'), 404);
  const form = await c.req.parseBody();
  if (form.mode === 'global') {
    await c.env.DB.prepare('DELETE FROM notices WHERE scope = ?').bind(cafe.id).run();
  } else {
    const notice = form.mode === 'none' ? { text: '', url: null } : readNotice(form);
    if ('error' in notice) return cafePage(c, cafe, notice.error, 400);
    if (form.mode === 'custom' && !notice.text) return cafePage(c, cafe, 'Write the café’s own notice, or choose to show none.', 400);
    await c.env.DB.prepare('INSERT INTO notices (scope, text, url, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(scope) DO UPDATE SET text = excluded.text, url = excluded.url, updated_at = excluded.updated_at').bind(cafe.id, notice.text, notice.url, now()).run();
  }
  return c.redirect(`/cafes/${cafe.id}?done=notice`, 303);
});

/** Deploys the latest release with the owner's saved access, keeping the café's data and secrets. */
admin.post('/cafes/:id/deploy', async c => {
  const cafe = await cafeOf(c);
  if (!cafe) return c.html(views.errorPage('That café was not found.'), 404);
  const connection = await c.env.DB.prepare('SELECT * FROM connections WHERE owner_id = ?').bind(cafe.owner_id).first<ConnectionRow>();
  if (!connection || connection.account_id !== cafe.account_id) return cafePage(c, cafe, 'The owner’s saved access does not reach this café’s account, so it cannot be updated from here.', 409);
  try {
    // No setup code: an owner who still needs one asks for it from their dashboard.
    const result = await deployRow(c.env, c.req.url, cafe, connection);
    await log(c, cafe.owner_id, 'update', result.version, cafe.id);
  } catch (error) {
    await log(c, cafe.owner_id, 'deploy-failed', message(error), cafe.id);
    return cafePage(c, (await cafeOf(c))!, message(error), 502);
  }
  return c.redirect(`/cafes/${cafe.id}?done=updated`, 303);
});

admin.post('/cafes/:id/forget', async c => {
  const cafe = await cafeOf(c);
  if (!cafe) return c.html(views.errorPage('That café was not found.'), 404);
  await c.env.DB.batch([c.env.DB.prepare('DELETE FROM cafes WHERE id = ?').bind(cafe.id), c.env.DB.prepare('DELETE FROM notices WHERE scope = ?').bind(cafe.id)]);
  await log(c, cafe.owner_id, 'forget', cafe.script_name, cafe.id);
  return c.redirect('/?done=forgotten', 303);
});

admin.post('/cafes/:id/delete', async c => {
  const cafe = await cafeOf(c);
  if (!cafe) return c.html(views.errorPage('That café was not found.'), 404);
  if (String((await c.req.parseBody()).confirm || '').trim() !== cafe.script_name) return cafePage(c, cafe, 'The Worker name does not match. Nothing was deleted.', 400);
  const connection = await c.env.DB.prepare('SELECT * FROM connections WHERE owner_id = ?').bind(cafe.owner_id).first<ConnectionRow>();
  if (!connection || connection.account_id !== cafe.account_id) return cafePage(c, cafe, 'The owner’s saved access does not reach this café’s account, so it cannot be deleted from here. Remove it from the platform instead.', 409);
  try { await deleteCafe(await clientFor(c.env, connection), resourcesOf(cafe)); } catch (error) { return cafePage(c, cafe, message(error), 502); }
  await c.env.DB.batch([c.env.DB.prepare('DELETE FROM cafes WHERE id = ?').bind(cafe.id), c.env.DB.prepare('DELETE FROM notices WHERE scope = ?').bind(cafe.id)]);
  await log(c, cafe.owner_id, 'delete', cafe.script_name, cafe.id);
  return c.redirect('/?done=deleted', 303);
});

admin.get('/accounts/:id', async c => {
  const id = c.req.param('id');
  const [connection, cafes, history] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM connections WHERE owner_id = ?').bind(id).first<ConnectionRow>(),
    c.env.DB.prepare('SELECT * FROM cafes WHERE owner_id = ? ORDER BY created_at').bind(id).all<CafeRow>(),
    c.env.DB.prepare('SELECT action, detail, cafe_id, created_at FROM audit_log WHERE owner_id = ? ORDER BY id DESC LIMIT 50').bind(id).all<{ action: string; detail: string; cafe_id: string | null; created_at: string }>()
  ]);
  if (!connection && !cafes.results.length) return c.html(views.errorPage('That account was not found.'), 404);
  const sessions = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM sessions WHERE owner_id = ? AND expires_at > ?').bind(id, Date.now()).first<{ n: number }>();
  return c.html(views.account({
    csrf: await csrf(c), id, connection: connection && { name: connection.account_name, method: connection.method, accountId: connection.account_id, connectedAt: connection.created_at, updatedAt: connection.updated_at },
    sessions: sessions?.n ?? 0, cafes: cafes.results, history: history.results
  }));
});

/** Revokes the account's access, signs it out everywhere and forgets its cafés. The cafés keep running in its account. */
admin.post('/accounts/:id/remove', async c => {
  const id = c.req.param('id');
  const connection = await c.env.DB.prepare('SELECT * FROM connections WHERE owner_id = ?').bind(id).first<ConnectionRow>();
  if (connection) await revoke(c.env, await decrypt<Credentials>(c.env.ENCRYPTION_KEY, id, connection.credentials).catch(() => ({ kind: 'token', token: '' }) as Credentials));
  const db = c.env.DB;
  await db.batch([
    db.prepare("DELETE FROM notices WHERE scope IN (SELECT id FROM cafes WHERE owner_id = ?)").bind(id),
    db.prepare('DELETE FROM cafes WHERE owner_id = ?').bind(id),
    db.prepare('DELETE FROM sessions WHERE owner_id = ?').bind(id),
    db.prepare('DELETE FROM connections WHERE owner_id = ?').bind(id)
  ]);
  await log(c, id, 'remove-account', connection?.account_name ?? '');
  return c.redirect('/?done=removed', 303);
});

admin.notFound(c => c.html(views.errorPage('This page does not exist.'), 404));
admin.onError((error, c) => {
  console.error('Admin request failed', error);
  return c.html(views.errorPage('Something went wrong on our side. Please try again.'), 500);
});

export default admin;
