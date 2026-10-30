import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import schema from '../schema.sql';
import { safeEqual } from '../../src/utils/passwords';
import { CloudflareClient, CloudflareError, checkAccess, deleteCafe, deployCafe, setSetupToken, type CafeResources, type Release } from './cloudflare';
import { decrypt, encrypt, randomToken, sha256 } from './crypto';
import { authorizeUrl, exchangeCode, newVerifier, oauthConfigured, refresh, revoke, type Credentials, type OAuthEnv } from './oauth';
import { applyTheme, FAVICON, THEME_COOKIE, THEME_SWITCH_COOKIE, themeScriptSource } from './design';
import { LOGO_PNG } from './logo';
import * as views from './views';

type Bindings = OAuthEnv & {
  DB: D1Database;
  /** The packaged café release (release/ from npm run release), never served to visitors. */
  RELEASE: Fetcher;
  /** 32 random bytes, base64: encrypts the Cloudflare credentials owners connect. */
  ENCRYPTION_KEY: string;
};
/** Owners are Cloudflare accounts: whoever can reach an account with OAuth or a token manages its cafés. */
type Owner = { id: string; name: string };
type Env = { Bindings: Bindings; Variables: { owner: Owner | null; session: string | null } };
type C = Context<Env>;

const SESSION_DAYS = 7;
const SESSION_COOKIE = 'cp_session';
const OAUTH_COOKIE = 'cp_oauth';

const ready = new WeakMap<object, Promise<void>>();
function ensureSchema(db: D1Database) {
  let pending = ready.get(db);
  if (!pending) {
    const statements = schema.replace(/^--.*$/gm, '').replace(/--[^\n]*/g, '').split(';').map(sql => sql.trim()).filter(Boolean);
    pending = db.batch(statements.map(sql => db.prepare(sql))).then(() => {});
    ready.set(db, pending);
    pending.catch(() => ready.delete(db));
  }
  return pending;
}

let releaseCache: Promise<Release> | null = null;
const releaseFile = (env: Bindings) => (path: string) => env.RELEASE.fetch(new Request(`https://release/${path}`));
function currentRelease(env: Bindings) {
  releaseCache ??= releaseFile(env)('manifest.json').then(async response => {
    if (!response.ok) throw new Error('The control plane was deployed without a café release. Run npm run release before deploying it.');
    return response.json() as Promise<Release>;
  });
  releaseCache.catch(() => { releaseCache = null; });
  return releaseCache;
}

const now = () => new Date().toISOString();
const audit = (c: C, action: string, detail = '', cafeId: string | null = null) =>
  c.env.DB.prepare('INSERT INTO audit_log (owner_id, cafe_id, action, detail, created_at) VALUES (?, ?, ?, ?, ?)').bind(c.get('owner')!.id, cafeId, action, detail.slice(0, 500), now()).run();

/** Tied to the session, so a form posted from another site cannot carry it. */
const csrfFor = (session: string) => sha256(`csrf:${session}`);

/** Allows ten failures per action and address every 15 minutes. */
async function attempts(c: C, action: string) {
  const key = `${action}:${c.req.header('CF-Connecting-IP') || 'local'}`;
  const row = await c.env.DB.prepare('SELECT count FROM attempts WHERE key = ? AND expires_at > ?').bind(key, Date.now()).first<{ count: number }>();
  return {
    blocked: (row?.count ?? 0) >= 10,
    fail: () => c.env.DB.prepare('INSERT INTO attempts (key, count, expires_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = CASE WHEN expires_at > ? THEN count + 1 ELSE 1 END, expires_at = excluded.expires_at')
      .bind(key, Date.now() + 15 * 60000, Date.now()).run(),
    clear: () => c.env.DB.prepare('DELETE FROM attempts WHERE key = ?').bind(key).run()
  };
}

async function startSession(c: C, ownerId: string) {
  const previous = c.get('session');
  if (previous) await c.env.DB.prepare('DELETE FROM sessions WHERE id_hash = ?').bind(await sha256(previous)).run();
  const token = randomToken();
  await c.env.DB.prepare('INSERT INTO sessions (id_hash, owner_id, expires_at) VALUES (?, ?, ?)').bind(await sha256(token), ownerId, Date.now() + SESSION_DAYS * 86400000).run();
  // Lax, not Strict: Cloudflare's OAuth consent redirects back here, and that top-level navigation must carry the session.
  setCookie(c, SESSION_COOKIE, token, { httpOnly: true, secure: new URL(c.req.url).protocol === 'https:', sameSite: 'Lax', path: '/', maxAge: SESSION_DAYS * 86400 });
}

type ConnectionRow = { owner_id: string; method: 'token' | 'oauth'; account_id: string; account_name: string; credentials: string };
type CafeRow = {
  id: string; owner_id: string; account_id: string; name: string; script_name: string; database_id: string | null; kv_namespace_id: string | null;
  custom_domain: string | null; url: string | null; admin_url: string | null; version: string | null; status: 'deploying' | 'live' | 'failed'; last_error: string | null;
};

const connectionOf = (c: C) => c.env.DB.prepare('SELECT * FROM connections WHERE owner_id = ?').bind(c.get('owner')!.id).first<ConnectionRow>();

/** A client for the owner's account, refreshing an OAuth access token that is about to expire. */
async function clientFor(c: C, connection: ConnectionRow) {
  const ownerId = c.get('owner')!.id;
  let credentials = await decrypt<Credentials>(c.env.ENCRYPTION_KEY, ownerId, connection.credentials).catch(() => {
    throw new Error('The saved Cloudflare access cannot be read. Disconnect and connect your account again.');
  });
  if (credentials.kind === 'oauth' && credentials.expiresAt < Date.now() + 60000) {
    credentials = await refresh(c.env, credentials);
    await c.env.DB.prepare('UPDATE connections SET credentials = ?, updated_at = ? WHERE owner_id = ?').bind(await encrypt(c.env.ENCRYPTION_KEY, ownerId, credentials), now(), ownerId).run();
  }
  return new CloudflareClient(credentials.kind === 'token' ? credentials.token : credentials.accessToken);
}

/** Signs in as one of the accounts the credentials reach, after checking they can deploy a café there. */
async function signIn(c: C, method: 'token' | 'oauth', credentials: Credentials, preferredAccount?: string) {
  const client = new CloudflareClient(credentials.kind === 'token' ? credentials.token : credentials.accessToken);
  const accounts = await client.accounts();
  if (!accounts.length) throw new CloudflareError('These credentials do not reach any Cloudflare account.', 403);
  const account = preferredAccount ? accounts.find(a => a.id === preferredAccount) : accounts[0];
  if (!account) throw new CloudflareError('These credentials cannot reach that account ID.', 403);
  await checkAccess(client, account.id);
  const ownerId = account.id;
  await c.env.DB.prepare(`INSERT INTO connections (owner_id, method, account_id, account_name, credentials, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(owner_id) DO UPDATE SET method = excluded.method, account_id = excluded.account_id, account_name = excluded.account_name, credentials = excluded.credentials, updated_at = excluded.updated_at`)
    .bind(ownerId, method, account.id, account.name, await encrypt(c.env.ENCRYPTION_KEY, ownerId, credentials), now(), now()).run();
  c.set('owner', { id: ownerId, name: account.name });
  await startSession(c, ownerId);
  await audit(c, 'connect', method);
}

const message = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';
const FLASH: Record<string, string> = {
  connected: 'Signed in with your Cloudflare account.',
  account: 'Switched Cloudflare account.',
  forgotten: 'The café is no longer managed here. It keeps running in your account.',
  deleted: 'The café and its data were deleted from your Cloudflare account.'
};

const SCRIPT_NAME = /^[a-z0-9](?:[a-z0-9-]{0,52}[a-z0-9])?$/;
const HOSTNAME = /^(?=.{4,200}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const slug = (name: string) => name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);

const app = new Hono<Env>();

// Pages render without a theme; the saved one is applied here so no view has to know about it.
app.use('*', async (c, next) => {
  await next();
  if (!c.res.headers.get('Content-Type')?.startsWith('text/html')) return;
  const switched = getCookie(c, THEME_SWITCH_COOKIE) === '1';
  const res = c.res;
  const headers = new Headers(res.headers);
  headers.delete('Content-Length');
  c.res = new Response(applyTheme(await res.text(), getCookie(c, THEME_COOKIE), switched), { status: res.status, headers });
  if (switched) deleteCookie(c, THEME_SWITCH_COOKIE, { path: '/' });
});

app.use('*', async (c, next) => {
  await ensureSchema(c.env.DB);
  c.header('X-Frame-Options', 'DENY');
  // The only script is the theme toggle, allowed by its hash.
  c.header('Content-Security-Policy', `default-src 'none'; script-src ${await themeScriptSource()}; style-src 'unsafe-inline'; img-src 'self' data:; form-action 'self' https://dash.cloudflare.com; frame-ancestors 'none'; base-uri 'none'`);
  // same-origin, not no-referrer: with no-referrer, browsers send "Origin: null" on form posts, which the origin check refuses.
  c.header('Referrer-Policy', 'same-origin');
  const token = getCookie(c, SESSION_COOKIE);
  let owner: Owner | null = null;
  if (token) {
    // A session lasts only while the account's access is saved: disconnecting signs every browser out.
    owner = await c.env.DB.prepare('SELECT c.owner_id AS id, c.account_name AS name FROM sessions s JOIN connections c ON c.owner_id = s.owner_id WHERE s.id_hash = ? AND s.expires_at > ?').bind(await sha256(token), Date.now()).first<Owner>();
  }
  c.set('owner', owner);
  c.set('session', owner ? token! : null);
  if (c.req.method === 'POST') {
    // Forms only come from this origin; signed-in forms, other than signing in again, also carry the session's CSRF token.
    const origin = c.req.header('Origin');
    if (origin && origin !== new URL(c.req.url).origin) return c.html(views.errorPage('This form was sent from another site.'), 403);
    if (owner && c.req.path !== '/connect/token' && c.req.path !== '/theme') {
      const form = await c.req.parseBody();
      if (typeof form.csrf !== 'string' || !(await safeEqual(form.csrf, await csrfFor(token!)))) return c.html(views.errorPage('This form expired. Go back, reload the page and try again.'), 403);
    }
  }
  await next();
});

const requireOwner = async (c: C, next: () => Promise<void>) => {
  if (!c.get('owner')) return c.redirect('/');
  await next();
};

const landing = (c: C, error?: string, status: 200 | 400 | 429 = 200) =>
  c.html(views.landing({
    oauth: oauthConfigured(c.env),
    error: error ?? (c.req.query('error') === 'oauth' ? 'Cloudflare did not sign you in. Try again, or use an API token.' : undefined),
    message: c.req.query('done') === 'disconnected' ? 'Signed out and forgot your Cloudflare access. Your cafés keep running.' : undefined
  }), status);

app.get('/', c => c.get('owner') ? c.redirect('/dashboard') : landing(c));

const favicon = (c: C) => c.body(FAVICON, 200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' });
app.get('/favicon.svg', favicon);
app.get('/favicon.ico', favicon);
app.get('/logo.png', c => c.body(Uint8Array.from(atob(LOGO_PNG), ch => ch.charCodeAt(0)), 200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' }));

/** Saves the theme and goes back to the page it was chosen on, which then reveals it from the toggle. */
app.post('/theme', async c => {
  const form = await c.req.parseBody();
  const theme = form.theme === 'light' ? 'light' : 'dark';
  const secure = new URL(c.req.url).protocol === 'https:';
  setCookie(c, THEME_COOKIE, theme, { secure, sameSite: 'Lax', path: '/', maxAge: 365 * 86400 });
  setCookie(c, THEME_SWITCH_COOKIE, '1', { secure, sameSite: 'Lax', path: '/', maxAge: 30 });
  let back = '/';
  try {
    const referer = new URL(c.req.header('Referer') || '');
    // Only pages that can be loaded again; a page shown after a form goes to the dashboard.
    if (referer.origin === new URL(c.req.url).origin && /^\/(?:dashboard|cafes\/new|cafes\/[\w-]+\/delete)?$/.test(referer.pathname)) back = referer.pathname;
    else if (c.get('owner')) back = '/dashboard';
  } catch { /* no referer: go home */ }
  return c.redirect(back, 303);
});

app.post('/signout', async c => {
  const token = c.get('session');
  if (token) await c.env.DB.prepare('DELETE FROM sessions WHERE id_hash = ?').bind(await sha256(token)).run();
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.redirect('/', 303);
});

app.use('/dashboard', requireOwner);
app.use('/connect/account', requireOwner);
app.use('/disconnect', requireOwner);
app.use('/cafes', requireOwner);
app.use('/cafes/*', requireOwner);

/** Asks the café itself whether its owner has finished setup. Unknown when it does not answer quickly. */
async function setupPending(cafe: CafeRow) {
  if (cafe.status !== 'live' || !cafe.url) return null;
  try {
    const response = await fetch(`${cafe.url}/api/auth/session`, { signal: AbortSignal.timeout(3000) });
    const session = await response.json() as { setupRequired?: boolean };
    return session.setupRequired === true;
  } catch { return null; }
}

app.get('/dashboard', async c => {
  const owner = c.get('owner')!;
  const [connection, release, { results: cafes }] = await Promise.all([
    connectionOf(c),
    currentRelease(c.env),
    c.env.DB.prepare('SELECT * FROM cafes WHERE owner_id = ? ORDER BY created_at').bind(owner.id).all<CafeRow>()
  ]);
  let accounts: { id: string; name: string }[] | undefined;
  let error: string | undefined;
  if (connection) {
    try { accounts = await (await clientFor(c, connection)).accounts(); } catch (e) { error = `Cloudflare is not accepting the saved access: ${message(e)} Sign out and sign in again.`; }
  }
  const pending = await Promise.all(cafes.map(setupPending));
  return c.html(views.dashboard({
    accountName: owner.name, csrf: await csrfFor(c.get('session')!), oauth: oauthConfigured(c.env), currentVersion: release.version, accounts,
    message: FLASH[c.req.query('done') || ''], error,
    connection: connection && { method: connection.method, accountId: connection.account_id, accountName: connection.account_name },
    cafes: cafes.map((cafe, i) => ({
      id: cafe.id, name: cafe.name, scriptName: cafe.script_name, url: cafe.url, adminUrl: cafe.admin_url, customDomain: cafe.custom_domain,
      version: cafe.version, status: cafe.status, lastError: cafe.last_error, setupPending: pending[i]
    }))
  }));
});

app.post('/connect/token', async c => {
  const form = await c.req.parseBody();
  const token = String(form.token || '').trim();
  const accountId = String(form.accountId || '').trim() || undefined;
  const limit = await attempts(c, 'token');
  if (limit.blocked) return landing(c, 'Too many attempts. Try again in 15 minutes.', 429);
  try {
    await signIn(c, 'token', { kind: 'token', token }, accountId);
  } catch (error) {
    await limit.fail();
    return landing(c, message(error), 400);
  }
  await limit.clear();
  return c.redirect('/dashboard?done=connected', 303);
});

app.get('/connect/oauth', async c => {
  if (!oauthConfigured(c.env)) return landing(c, 'Signing in with Cloudflare is not set up here yet. Use an API token instead.', 400);
  const state = randomToken();
  const verifier = newVerifier();
  await c.env.DB.prepare('DELETE FROM oauth_logins WHERE expires_at < ?').bind(Date.now()).run();
  await c.env.DB.prepare('INSERT INTO oauth_logins (state_hash, verifier, expires_at) VALUES (?, ?, ?)').bind(await sha256(state), verifier, Date.now() + 10 * 60000).run();
  // The state also goes in a cookie, so a callback link made in another browser cannot sign this one in.
  setCookie(c, OAUTH_COOKIE, state, { httpOnly: true, secure: new URL(c.req.url).protocol === 'https:', sameSite: 'Lax', path: '/connect/oauth', maxAge: 600 });
  return c.redirect(await authorizeUrl(c.env, new URL('/connect/oauth/callback', c.req.url).toString(), state, verifier));
});

app.get('/connect/oauth/callback', async c => {
  const state = c.req.query('state') || '';
  const code = c.req.query('code') || '';
  if (!state || !(await safeEqual(state, getCookie(c, OAUTH_COOKIE) || ''))) return c.redirect('/?error=oauth', 303);
  deleteCookie(c, OAUTH_COOKIE, { path: '/connect/oauth' });
  // The state is single use.
  const row = await c.env.DB.prepare('DELETE FROM oauth_logins WHERE state_hash = ? AND expires_at > ? RETURNING verifier').bind(await sha256(state), Date.now()).first<{ verifier: string }>();
  if (!row || !code || c.req.query('error')) return c.redirect('/?error=oauth', 303);
  try {
    const credentials = await exchangeCode(c.env, code, row.verifier, new URL('/connect/oauth/callback', c.req.url).toString());
    await signIn(c, 'oauth', credentials);
  } catch (error) {
    return landing(c, message(error), 400);
  }
  return c.redirect('/dashboard?done=connected', 303);
});

app.post('/connect/account', async c => {
  const connection = await connectionOf(c);
  if (!connection) return c.redirect('/dashboard', 303);
  const form = await c.req.parseBody();
  try {
    // Refreshes an expiring OAuth token first, then reads the saved credentials back.
    await clientFor(c, connection);
    const saved = (await connectionOf(c))!;
    await signIn(c, saved.method, await decrypt<Credentials>(c.env.ENCRYPTION_KEY, c.get('owner')!.id, saved.credentials), String(form.accountId || ''));
  } catch (error) {
    return c.html(views.errorPage(message(error)), 400);
  }
  return c.redirect('/dashboard?done=account', 303);
});

app.post('/disconnect', async c => {
  const connection = await connectionOf(c);
  if (connection) {
    await revoke(c.env, await decrypt<Credentials>(c.env.ENCRYPTION_KEY, c.get('owner')!.id, connection.credentials).catch(() => ({ kind: 'token', token: '' }) as Credentials));
    await c.env.DB.prepare('DELETE FROM connections WHERE owner_id = ?').bind(c.get('owner')!.id).run();
    await c.env.DB.prepare('DELETE FROM sessions WHERE owner_id = ?').bind(c.get('owner')!.id).run();
    await audit(c, 'disconnect', connection.method);
  }
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.redirect('/?done=disconnected', 303);
});

app.get('/cafes/new', async c => c.html(views.newCafe({ csrf: await csrfFor(c.get('session')!) })));

const resourcesOf = (cafe: CafeRow): CafeResources => ({
  accountId: cafe.account_id, scriptName: cafe.script_name, databaseId: cafe.database_id, kvNamespaceId: cafe.kv_namespace_id, customDomain: cafe.custom_domain
});

/** Deploys a café row, recording the outcome on it; a first deploy gets a fresh setup code. */
async function runDeploy(c: C, cafe: CafeRow, connection: ConnectionRow, demoData = false) {
  const release = await currentRelease(c.env);
  const firstDeploy = !cafe.version;
  const setupToken = firstDeploy ? randomToken(24) : undefined;
  try {
    const result = await deployCafe(await clientFor(c, connection), resourcesOf(cafe), release, releaseFile(c.env), { setupToken, demoData });
    await c.env.DB.prepare("UPDATE cafes SET database_id = ?, kv_namespace_id = ?, url = ?, admin_url = ?, version = ?, status = 'live', last_error = NULL, updated_at = ? WHERE id = ?")
      .bind(result.databaseId, result.kvNamespaceId, result.url, result.adminUrl, release.version, now(), cafe.id).run();
    await audit(c, firstDeploy ? 'deploy' : 'update', release.version, cafe.id);
    return c.html(views.deployed({ csrf: await csrfFor(c.get('session')!), name: cafe.name, url: result.url, setupUrl: setupToken ? `${result.adminUrl}#setup=${setupToken}` : null, kind: firstDeploy ? 'deployed' : 'updated' }));
  } catch (error) {
    await c.env.DB.prepare("UPDATE cafes SET status = CASE WHEN version IS NULL THEN 'failed' ELSE status END, last_error = ?, updated_at = ? WHERE id = ?").bind(message(error).slice(0, 1000), now(), cafe.id).run();
    await audit(c, 'deploy-failed', message(error), cafe.id);
    return c.html(views.errorPage(`${message(error)} Fix it, then retry from your dashboard.`), 502);
  }
}

app.post('/cafes', async c => {
  const csrf = await csrfFor(c.get('session')!);
  const form = await c.req.parseBody();
  const values = { name: String(form.name || '').trim(), scriptName: String(form.scriptName || '').trim().toLowerCase(), customDomain: String(form.customDomain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''), demo: form.demo === '1' ? '1' : '' };
  const invalid = (error: string) => c.html(views.newCafe({ csrf, error, values }), 400);
  const connection = await connectionOf(c);
  if (!connection) return c.redirect('/dashboard', 303);
  if (!values.name || values.name.length > 100) return invalid('Enter a café name up to 100 characters.');
  const scriptName = values.scriptName || `cafe-${slug(values.name) || randomToken(4).toLowerCase()}`.slice(0, 54).replace(/-+$/, '');
  if (!SCRIPT_NAME.test(scriptName)) return invalid('Use lowercase letters, digits and dashes for the Worker name, starting and ending with a letter or digit.');
  if (values.customDomain && !HOSTNAME.test(values.customDomain)) return invalid('Enter a domain such as mycafe.com, without https:// or a path.');
  const id = crypto.randomUUID();
  try {
    await c.env.DB.prepare('INSERT INTO cafes (id, owner_id, account_id, name, script_name, custom_domain, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, c.get('owner')!.id, connection.account_id, values.name, scriptName, values.customDomain || null, 'deploying', now(), now()).run();
  } catch (error) {
    if (String(error).includes('UNIQUE')) return invalid(`A café named ${scriptName} is already managed on this Cloudflare account. Choose another Worker name.`);
    throw error;
  }
  const cafe = await c.env.DB.prepare('SELECT * FROM cafes WHERE id = ?').bind(id).first<CafeRow>();
  return runDeploy(c, cafe!, connection, values.demo === '1');
});

/** Loads one of the owner's cafés with the connection that can reach its account. */
async function ownedCafe(c: C) {
  const cafe = await c.env.DB.prepare('SELECT * FROM cafes WHERE id = ? AND owner_id = ?').bind(c.req.param('id'), c.get('owner')!.id).first<CafeRow>();
  if (!cafe) return { response: c.html(views.errorPage('That café was not found.'), 404) };
  return { cafe };
}
async function reachableCafe(c: C) {
  const { cafe, response } = await ownedCafe(c);
  if (!cafe) return { response };
  const connection = await connectionOf(c);
  if (!connection) return { response: c.html(views.errorPage('Connect your Cloudflare account first.'), 409) };
  if (connection.account_id !== cafe.account_id) return { response: c.html(views.errorPage('This café is in a different Cloudflare account. Switch to that account on your dashboard first.'), 409) };
  return { cafe, connection };
}

app.post('/cafes/:id/deploy', async c => {
  const { cafe, connection, response } = await reachableCafe(c);
  if (!cafe || !connection) return response;
  return runDeploy(c, cafe, connection);
});

app.post('/cafes/:id/setup-link', async c => {
  const { cafe, connection, response } = await reachableCafe(c);
  if (!cafe || !connection) return response;
  if (!cafe.url || !cafe.admin_url) return c.html(views.errorPage('Deploy the café first.'), 409);
  const token = randomToken(24);
  try { await setSetupToken(await clientFor(c, connection), resourcesOf(cafe), token); } catch (error) { return c.html(views.errorPage(message(error)), 502); }
  await audit(c, 'setup-link', '', cafe.id);
  return c.html(views.deployed({ csrf: await csrfFor(c.get('session')!), name: cafe.name, url: cafe.url, setupUrl: `${cafe.admin_url}#setup=${token}`, kind: 'setup-link' }));
});

app.get('/cafes/:id/delete', async c => {
  const { cafe, response } = await ownedCafe(c);
  if (!cafe) return response;
  return c.html(views.confirmDelete({ csrf: await csrfFor(c.get('session')!), id: cafe.id, name: cafe.name, scriptName: cafe.script_name }));
});

app.post('/cafes/:id/forget', async c => {
  const { cafe, response } = await ownedCafe(c);
  if (!cafe) return response;
  await c.env.DB.prepare('DELETE FROM cafes WHERE id = ?').bind(cafe.id).run();
  await audit(c, 'forget', cafe.script_name, cafe.id);
  return c.redirect('/dashboard?done=forgotten', 303);
});

app.post('/cafes/:id/delete', async c => {
  const { cafe, connection, response } = await reachableCafe(c);
  if (!cafe || !connection) return response;
  const form = await c.req.parseBody();
  const csrf = await csrfFor(c.get('session')!);
  if (String(form.confirm || '').trim() !== cafe.script_name) return c.html(views.confirmDelete({ csrf, id: cafe.id, name: cafe.name, scriptName: cafe.script_name, error: 'The name does not match. Nothing was deleted.' }), 400);
  try { await deleteCafe(await clientFor(c, connection), resourcesOf(cafe)); } catch (error) {
    return c.html(views.confirmDelete({ csrf, id: cafe.id, name: cafe.name, scriptName: cafe.script_name, error: message(error) }), 502);
  }
  await c.env.DB.prepare('DELETE FROM cafes WHERE id = ?').bind(cafe.id).run();
  await audit(c, 'delete', cafe.script_name, cafe.id);
  return c.redirect('/dashboard?done=deleted', 303);
});

app.notFound(c => c.html(views.errorPage('This page does not exist.'), 404));
app.onError((error, c) => {
  console.error('Control plane request failed', error);
  return c.html(views.errorPage('Something went wrong on our side. Please try again.'), 500);
});

export default app;
