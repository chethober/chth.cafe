import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { safeEqual } from '../../src/utils/passwords';
import { CloudflareClient, CloudflareError, checkAccess, deleteCafe, setSetupToken } from './cloudflare';
import { decrypt, encrypt, randomToken, sha256 } from './crypto';
import { authorizeUrl, exchangeCode, newVerifier, oauthConfigured, revoke, type Credentials } from './oauth';
import { FAVICON, THEME_COOKIE, THEME_SWITCH_COOKIE } from './design';
import { LOGO_PNG } from './logo';
import { attempts, audit as auditFor, clientFor as clientForEnv, currentRelease, deployRow, guarded, message, now, resourcesOf, themed, type Bindings, type CafeRow, type ConnectionRow } from './shared';
import internal from './internal';
import * as views from './views';
import { landingLocale, localizeLanding } from './i18n';
import { track } from './hub';

/** Owners are Cloudflare accounts: whoever can reach an account with OAuth or a token manages its cafés. */
type Owner = { id: string; name: string };
type Env = { Bindings: Bindings; Variables: { owner: Owner | null; session: string | null } };
type C = Context<Env>;

const SESSION_DAYS = 7;
const SESSION_COOKIE = 'cp_session';
const OAUTH_COOKIE = 'cp_oauth';

const audit = (c: C, action: string, detail = '', cafeId: string | null = null) => auditFor(c.env.DB, c.get('owner')!.id, action, detail, cafeId);

/** Tied to the session, so a form posted from another site cannot carry it. */
const csrfFor = (session: string) => sha256(`csrf:${session}`);

async function startSession(c: C, ownerId: string) {
  const previous = c.get('session');
  if (previous) await c.env.DB.prepare('DELETE FROM sessions WHERE id_hash = ?').bind(await sha256(previous)).run();
  const token = randomToken();
  await c.env.DB.prepare('INSERT INTO sessions (id_hash, owner_id, expires_at) VALUES (?, ?, ?)').bind(await sha256(token), ownerId, Date.now() + SESSION_DAYS * 86400000).run();
  // Lax, not Strict: Cloudflare's OAuth consent redirects back here, and that top-level navigation must carry the session.
  setCookie(c, SESSION_COOKIE, token, { httpOnly: true, secure: new URL(c.req.url).protocol === 'https:', sameSite: 'Lax', path: '/', maxAge: SESSION_DAYS * 86400 });
}

const connectionOf = (c: C) => c.env.DB.prepare('SELECT * FROM connections WHERE owner_id = ?').bind(c.get('owner')!.id).first<ConnectionRow>();
const clientFor = (c: C, connection: ConnectionRow) => clientForEnv(c.env, connection);

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

app.use('*', themed, guarded);

app.use('*', async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  let owner: Owner | null = null;
  if (token) {
    // A session lasts only while the account's access is saved: disconnecting signs every browser out.
    owner = await c.env.DB.prepare('SELECT c.owner_id AS id, c.account_name AS name FROM sessions s JOIN connections c ON c.owner_id = s.owner_id WHERE s.id_hash = ? AND s.expires_at > ?').bind(await sha256(token), Date.now()).first<Owner>();
  }
  c.set('owner', owner);
  c.set('session', owner ? token! : null);
  if (c.req.method === 'POST') {
    // Signed-in forms, other than signing in again, also carry the session's CSRF token.
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

const landing = async (c: C, error?: string, status: 200 | 400 | 429 = 200) => {
  const { locale, setCookie } = landingLocale(c.req.raw);
  if (setCookie) c.header('Set-Cookie', setCookie, { append: true });
  c.header('Content-Language', locale);
  c.header('Vary', 'Cookie, Accept-Language');
  const ref = c.req.query('ref');
  if (ref && /^[a-zA-Z0-9_]{1,40}$/.test(ref)) track(c, 'visit', { ref, lang: locale });
  const page = await views.landing({
    oauth: oauthConfigured(c.env),
    error: error ?? (c.req.query('error') === 'oauth' ? 'Cloudflare did not sign you in. Try again, or use an API token.' : undefined),
    message: c.req.query('done') === 'disconnected' ? 'Signed out and forgot your Cloudflare access. Your cafés keep running.' : undefined
  });
  return c.html(localizeLanding(String(page), locale), status);
};

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
  const refused = c.req.query('error');
  if (refused) return landing(c, `Cloudflare did not sign you in: ${(c.req.query('error_description') || refused).slice(0, 300)} Use an API token instead.`, 400);
  if (!row || !code) return c.redirect('/?error=oauth', 303);
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

/** Deploys a café row, recording the outcome on it; a first deploy gets a fresh setup code. */
async function runDeploy(c: C, cafe: CafeRow, connection: ConnectionRow, demoData = false) {
  const firstDeploy = !cafe.version;
  const setupToken = firstDeploy ? randomToken(24) : undefined;
  try {
    const result = await deployRow(c.env, c.req.url, cafe, connection, { setupToken, demoData });
    await audit(c, firstDeploy ? 'deploy' : 'update', result.version, cafe.id);
    track(c, 'deploy', { ok: true, kind: firstDeploy ? 'create' : 'update', version: result.version });
    return c.html(views.deployed({ csrf: await csrfFor(c.get('session')!), name: cafe.name, url: result.url, setupUrl: setupToken ? `${result.adminUrl}#setup=${setupToken}` : null, kind: firstDeploy ? 'deployed' : 'updated' }));
  } catch (error) {
    await audit(c, 'deploy-failed', message(error), cafe.id);
    track(c, 'deploy', { ok: false, kind: firstDeploy ? 'create' : 'update', error: message(error).slice(0, 200) });
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

/** The notice line a café shows in its admin and panel, asked for by the café's own Worker. Public: it is an advert. */
app.get('/api/notice', async c => {
  const cafe = c.req.query('cafe') || '';
  const { results } = await c.env.DB.prepare("SELECT scope, text, url FROM notices WHERE scope IN ('global', ?)").bind(cafe).all<{ scope: string; text: string; url: string | null }>();
  const row = results.find(r => r.scope === cafe && cafe) || results.find(r => r.scope === 'global');
  c.header('Cache-Control', 'public, max-age=30');
  return c.json({ notice: row?.text ? { text: row.text, url: row.url || null } : null });
});

app.notFound(c => c.html(views.errorPage('This page does not exist.'), 404));
app.onError((error, c) => {
  console.error('Control plane request failed', error);
  return c.html(views.errorPage('Something went wrong on our side. Please try again.'), 500);
});

/** /internal/* is the platform admin for the CHTH hub's signed calls (internal.ts); everything else is the owner site. */
export default {
  fetch: (request: Request, env: Bindings, ctx: ExecutionContext) => (new URL(request.url).pathname.startsWith('/internal/') ? internal : app).fetch(request, env, ctx)
};
