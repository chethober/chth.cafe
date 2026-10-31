import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { Miniflare, Log, LogLevel, convertV4MiniflareOptions } from 'miniflare';

// The control plane against a fake Cloudflare API: it must create, update and delete a café with the
// same calls wrangler makes, keep credentials encrypted, and never let one owner reach another's café.
// Owners are Cloudflare accounts: the API token reaches acc1, the OAuth token reaches acc2.
const ASSETS = {
  '/index.html': { body: '<!doctype html><title>Café</title>', hash: 'a'.repeat(32), contentType: 'text/html; charset=utf-8' },
  '/assets/app.js': { body: 'console.log("café")', hash: 'b'.repeat(32), contentType: 'text/javascript; charset=utf-8' }
};
const release = {
  name: 'chth-cafe-manager', version: '1.0.0-test.abc1234', commit: 'abc1234', mainModule: 'server.js',
  compatibilityDate: '2025-01-01', compatibilityFlags: ['nodejs_compat'], runWorkerFirst: true, crons: ['0 * * * *'], demoSql: 'demo.sql',
  assets: Object.fromEntries(Object.entries(ASSETS).map(([path, asset]) => [path, { hash: asset.hash, size: asset.body.length, contentType: asset.contentType }]))
};
const releaseFiles = {
  'manifest.json': JSON.stringify(release),
  'server.js': 'export default { fetch() { return new Response("café"); } };',
  'demo.sql': "INSERT OR IGNORE INTO categories (id, name, display_order, icon) VALUES ('demo', 'Demo', 1, 'coffee');",
  ...Object.fromEntries(Object.entries(ASSETS).map(([path, asset]) => [`assets${path}`, asset.body]))
};

const calls = [];
const scripts = [];
let setupRequired = true;
let issuedChallenge = '';
let grantedScope = 'workers-scripts.write workers-kv-storage.write d1.write account-settings.read';
const ok = result => Response.json({ success: true, errors: [], result });
async function cloudflare(request) {
  const url = new URL(request.url);
  if (url.hostname === 'dash.cloudflare.com' && url.pathname === '/oauth2/token') {
    const form = new URLSearchParams(await request.text());
    calls.push({ method: 'POST', path: '/oauth2/token', grant: form.get('grant_type') });
    const challenge = createHash('sha256').update(form.get('code_verifier') || '').digest('base64url');
    if (form.get('code') !== 'good-code' || challenge !== issuedChallenge || form.get('client_id') !== 'test-client') return Response.json({ error: 'invalid_grant' }, { status: 400 });
    return Response.json({ access_token: 'oauth-access', refresh_token: 'oauth-refresh', expires_in: 3600, scope: grantedScope });
  }
  if (url.hostname === 'dash.cloudflare.com' && url.pathname === '/oauth2/revoke') { calls.push({ method: 'POST', path: '/oauth2/revoke', token: new URLSearchParams(await request.text()).get('token') }); return new Response(null, { status: 200 }); }
  if (url.hostname.endsWith('.workers.dev')) return Response.json({ authenticated: false, setupRequired });
  assert.equal(url.hostname, 'api.cloudflare.com');
  const path = url.pathname.replace('/client/v4', '');
  const auth = request.headers.get('Authorization');
  calls.push({ method: request.method, path, search: url.search, auth });
  const route = `${request.method} ${path}`;
  if (path.includes('/workers/assets/upload')) {
    assert.equal(auth, 'Bearer upload-session-jwt');
    const form = await request.formData();
    const file = form.get('b'.repeat(32));
    assert.equal(await file.text(), Buffer.from(ASSETS['/assets/app.js'].body).toString('base64'));
    return ok({ jwt: 'assets-complete-jwt' });
  }
  if (auth !== 'Bearer api-token' && auth !== 'Bearer oauth-access') return Response.json({ success: false, errors: [{ code: 10000, message: 'Authentication error' }] }, { status: 403 });
  const account = auth === 'Bearer oauth-access' ? 'acc2' : 'acc1';
  if (route === 'GET /accounts') return ok(account === 'acc1' ? [{ id: 'acc1', name: 'Corner Beans Ltd' }] : [{ id: 'acc2', name: 'Stranger Roasters' }]);
  if ([`GET /accounts/${account}/workers/scripts`, `GET /accounts/${account}/d1/database`, `GET /accounts/${account}/storage/kv/namespaces`].includes(route)) return ok([]);
  if (route === 'GET /accounts/acc1/workers/subdomain') return ok({ subdomain: 'owner' });
  if (route === 'POST /accounts/acc1/d1/database') return ok({ uuid: 'db-1' });
  if (route === 'POST /accounts/acc1/storage/kv/namespaces') return ok({ id: 'kv-1' });
  if (route === 'POST /accounts/acc1/d1/database/db-1/query') { calls.at(-1).sql = (await request.json()).sql; return ok([]); }
  if (/^POST \/accounts\/acc1\/workers\/scripts\/[^/]+\/assets-upload-session$/.test(route)) {
    const { manifest } = await request.json();
    assert.deepEqual(Object.keys(manifest).sort(), Object.keys(ASSETS).sort());
    // Cloudflare already holds index.html; only app.js is uploaded.
    return ok({ jwt: 'upload-session-jwt', buckets: [['b'.repeat(32)]] });
  }
  if (/^PUT \/accounts\/acc1\/workers\/scripts\/[^/]+$/.test(route)) {
    const form = await request.formData();
    scripts.push({ metadata: JSON.parse(form.get('metadata')), module: await form.get('server.js').text(), type: form.get('server.js').type });
    return ok({});
  }
  if (/\/schedules$/.test(route)) { calls.at(-1).body = await request.json(); return ok({}); }
  if (/\/subdomain$/.test(route) || /\/secrets$/.test(route)) { calls.at(-1).body = await request.json(); return ok({}); }
  if (request.method === 'DELETE') return ok({});
  throw new Error(`Unexpected Cloudflare call ${route}`);
}

const bundle = await build({ entryPoints: ['control-plane/src/index.ts'], bundle: true, format: 'esm', platform: 'browser', loader: { '.sql': 'text' }, write: false });
const mf = new Miniflare(convertV4MiniflareOptions({
  log: new Log(LogLevel.NONE), modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2025-01-01',
  d1Databases: { DB: 'control-plane' },
  bindings: { ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'), CF_OAUTH_CLIENT_ID: 'test-client', HUB_SECRET: 'h'.repeat(32) },
  serviceBindings: { RELEASE: request => { const file = releaseFiles[new URL(request.url).pathname.slice(1)]; return file === undefined ? new Response('missing', { status: 404 }) : new Response(file); } },
  outboundService: cloudflare
}));
let checks = 0;
const check = (actual, expected) => { assert.deepEqual(actual, expected); checks++; };
const HOST = 'https://cloud.example.com';
// The platform admin is the CHTH hub's admin bot: signed calls to /internal/*.
const { signedHeaders } = await import('../src/chth-kit/hub.js');
const hub = async (method, path, payload, secret = 'h'.repeat(32)) => {
  const url = `${HOST}${path}`;
  const body = payload === undefined ? '' : JSON.stringify(payload);
  const headers = await signedHeaders({ source: 'hub', secret, method, url, body });
  const response = await mf.dispatchFetch(url, { method, headers, body: body || undefined });
  return { status: response.status, json: await response.json() };
};
const browser = (host = HOST) => {
  const jar = new Map();
  return async (path, form, headers = {}) => {
    const response = await mf.dispatchFetch(`${host}${path}`, {
      method: form ? 'POST' : 'GET', redirect: 'manual',
      headers: { Cookie: [...jar].map(([name, value]) => `${name}=${value}`).join('; '), Origin: host, ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}), ...headers },
      ...(form ? { body: new URLSearchParams(form).toString() } : {})
    });
    for (const set of response.headers.getSetCookie()) {
      const [, name, value] = /^([^=]+)=([^;]*)/.exec(set);
      if (/Max-Age=0/i.test(set) || !value) jar.delete(name); else jar.set(name, value);
    }
    return response;
  };
};
let response;
const csrfOf = async response => /name="csrf" value="([^"]+)"/.exec(await response.text())?.[1];
try {
  const owner = browser();
  response = await owner('/');
  check(response.status, 200);
  // With no-referrer, browsers send "Origin: null" on form posts and every form would be refused.
  check(response.headers.get('referrer-policy'), 'same-origin');
  const landing = await response.text();
  assert.match(landing, /href="\/connect\/oauth"/); checks++;
  assert.match(landing, /permissionGroupKeys=/); checks++;
  check((await owner('/favicon.ico')).headers.get('content-type'), 'image/svg+xml');
  response = await owner('/logo.png');
  check([response.headers.get('content-type'), [...new Uint8Array(await response.arrayBuffer()).slice(1, 4)]], ['image/png', [80, 78, 71]]);
  // The theme toggle is a form: it saves the choice, goes back, and only the next page load reveals it.
  const viewer = browser();
  response = await viewer('/theme', { theme: 'light' }, { Referer: `${HOST}/` });
  check([response.status, response.headers.get('location')], [303, '/']);
  check((await viewer('/theme', { theme: 'dark' }, { Referer: 'https://evil.example/' })).headers.get('location'), '/');
  check(/<html[^>]*>/.exec(await (await viewer('/')).text())[0], '<html lang="en" data-theme="dark" data-theme-switch dir="ltr" data-chth-product="cafe">');
  check(/<html[^>]*>/.exec(await (await viewer('/')).text())[0], '<html lang="en" data-theme="dark" dir="ltr" data-chth-product="cafe">');
  check(/<html[^>]*>/.exec(landing)[0], '<html lang="en" dir="ltr" data-chth-product="cafe">');
  // The landing page speaks five languages: ?lang= picks one and remembers it.
  const persian = await viewer('/?lang=fa');
  check(/chth_lang=fa/.test(persian.headers.get('Set-Cookie') || ''), true);
  const persianPage = await persian.text();
  check(/<html lang="fa"[^>]*dir="rtl"/.test(persianPage), true);
  check(persianPage.includes('ورود با کلادفلر'), true);
  check(persianPage.includes('class="chth-footer"'), true);
  // One footer (the CHTH mark, linking to chth.wtf), the language menu in the navbar, and the brand fonts.
  check(persianPage.match(/<footer\b/g).length, 1);
  check(persianPage.includes('href="https://chth.wtf/?ref=cafe"') && persianPage.includes('بخشی از CHTH'), true);
  const menuAt = persianPage.indexOf('<details class="chth-lang-menu">');
  check(menuAt > persianPage.indexOf('<nav class="top"') && menuAt < persianPage.indexOf('<header class="hero"'), true);
  check(persianPage.includes('hreflang="fa" lang="fa" aria-current="true"'), true);
  check(landing.includes('fonts.googleapis.com/css2?family=Plus+Jakarta+Sans'), true);
  check(/font-src https:\/\/fonts\.gstatic\.com/.test(persian.headers.get('content-security-policy') || ''), true);
  check((await (await browser()('/', undefined, { 'Accept-Language': 'es-ES,es;q=0.9' })).text()).includes('Preguntas'), true);
  check((await mf.dispatchFetch(`${HOST}/internal/stats`)).status, 403);
  // There are no control plane accounts to sign up for.
  check((await owner('/signup')).status, 404);
  check((await owner('/signin', { email: 'owner@example.com', password: 'a-long-owner-password' })).status, 404);
  check((await owner('/dashboard')).headers.get('location'), '/');

  // Signing in with a token checks it can deploy, from this origin only.
  check((await browser()('/connect/token', { token: 'api-token' }, { Origin: 'null' })).status, 403);
  check((await owner('/connect/token', { token: 'api-token' }, { Origin: 'https://evil.example' })).status, 403);
  response = await owner('/connect/token', { token: 'wrong-token' });
  check(response.status, 400);
  assert.match(await response.text(), /Sign in with token/); checks++;
  response = await owner('/connect/token', { token: 'api-token' });
  check(response.headers.get('location'), '/dashboard?done=connected');
  const page = await (await owner('/dashboard')).text();
  assert.match(page, /Corner Beans Ltd/); checks++;
  const csrf = /name="csrf" value="([^"]+)"/.exec(page)[1];
  // Signed-in forms need the session's CSRF token.
  check((await owner('/cafes', { name: 'No token' })).status, 403);
  const db = await mf.getD1Database('DB');
  const connection = await db.prepare('SELECT * FROM connections').first();
  check([connection.owner_id, connection.method, connection.account_id, connection.account_name], ['acc1', 'token', 'acc1', 'Corner Beans Ltd']);
  assert.ok(!connection.credentials.includes('api-token') && connection.credentials.startsWith('v1.')); checks++;

  // First deploy: database, namespace, demo data, assets, Worker, cron, workers.dev, and a one-time setup link.
  check((await owner('/cafes', { csrf, name: 'Corner Beans', customDomain: 'https://not a domain' })).status, 400);
  response = await owner('/cafes', { csrf, name: 'Corner Beans', demo: '1' });
  const deployedPage = await response.text();
  check(response.status, 200);
  const setupToken = /https:\/\/cafe-corner-beans\.owner\.workers\.dev\/admin#setup=([\w-]+)/.exec(deployedPage)?.[1];
  assert.ok(setupToken, 'deployed page carries the setup link'); checks++;
  const first = scripts.at(-1);
  check(first.type, 'application/javascript+module');
  check(first.module, releaseFiles['server.js']);
  check(first.metadata.main_module, 'server.js');
  check([first.metadata.compatibility_date, first.metadata.compatibility_flags], ['2025-01-01', ['nodejs_compat']]);
  check(first.metadata.assets, { jwt: 'assets-complete-jwt', config: { run_worker_first: true } });
  check(first.metadata.keep_bindings, ['secret_text', 'secret_key']);
  const cafeId = (await (await mf.getD1Database('DB')).prepare('SELECT id FROM cafes').first()).id;
  check(first.metadata.bindings, [
    { type: 'd1', name: 'DB', id: 'db-1' },
    { type: 'kv_namespace', name: 'KV', namespace_id: 'kv-1' },
    { type: 'assets', name: 'ASSETS' },
    { type: 'plain_text', name: 'CAFE_WORKSPACE_PATHS', text: 'true' },
    { type: 'plain_text', name: 'PLATFORM_URL', text: HOST },
    { type: 'plain_text', name: 'PLATFORM_CAFE_ID', text: cafeId },
    { type: 'secret_text', name: 'SETUP_TOKEN', text: setupToken }
  ]);
  check(calls.find(call => call.path.endsWith('/schedules')).body, [{ cron: '0 * * * *' }]);
  check(calls.find(call => call.path.endsWith('/cafe-corner-beans/subdomain')).body, { enabled: true, previews_enabled: false });
  check(calls.find(call => call.path.endsWith('/query')).sql, releaseFiles['demo.sql']);
  const cafe = await db.prepare('SELECT * FROM cafes').first();
  check([cafe.status, cafe.version, cafe.database_id, cafe.kv_namespace_id, cafe.url], ['live', release.version, 'db-1', 'kv-1', 'https://cafe-corner-beans.owner.workers.dev']);
  // The control plane keeps no copy of the setup code.
  assert.ok(!JSON.stringify(await db.prepare('SELECT * FROM cafes').all()).includes(setupToken)); checks++;

  let dashboard = await (await owner('/dashboard')).text();
  assert.match(dashboard, /Waiting for setup/); assert.match(dashboard, /Up to date/); checks += 2;
  setupRequired = false;
  assert.match(await (await owner('/dashboard')).text(), />Live</); checks++;
  setupRequired = true;

  // A new setup link replaces the secret; redeploying keeps the secrets and adds no new setup code.
  response = await owner(`/cafes/${cafe.id}/setup-link`, { csrf });
  const newToken = /#setup=([\w-]+)/.exec(await response.text())[1];
  check(calls.find(call => call.path.endsWith('/secrets')).body, { name: 'SETUP_TOKEN', text: newToken, type: 'secret_text' });
  check((await owner(`/cafes/${cafe.id}/deploy`, { csrf })).status, 200);
  check(scripts.at(-1).metadata.bindings.some(binding => binding.name === 'SETUP_TOKEN'), false);
  check(calls.filter(call => call.method === 'POST' && call.path === '/accounts/acc1/d1/database').length, 1);

  // Anyone who can reach the same account manages the same cafés.
  const colleague = browser();
  await colleague('/connect/token', { token: 'api-token' });
  assert.match(await (await colleague('/dashboard')).text(), /Corner Beans/); checks++;

  // The platform admin: only the hub, with its secret, gets in; there is no admin website.
  check((await mf.dispatchFetch(`${HOST}/internal/cafes`)).status, 403);
  check((await hub('GET', '/internal/cafes', undefined, 'x'.repeat(32))).status, 403);
  check((await mf.dispatchFetch('https://admin.cloud.example.com/login', { method: 'POST' })).status, 404);
  const listed = (await hub('GET', '/internal/cafes')).json;
  check(listed.accounts.map(a => [a.name, a.cafes.map(c => c.id)]), [['Corner Beans Ltd', [cafe.id]]]);
  check(listed.accounts[0].cafes[0].notice, 'global');
  check((await hub('GET', `/internal/cafes/${cafe.id}`)).json.cafe.reachable, true);
  check((await hub('GET', '/internal/stats')).json.cafes, 1);
  check((await hub('POST', '/internal/notice', { text: 'Hi', url: 'http://plain.example' })).status, 400);
  // The notice line: global, then overridden per café; cafés ask the owner site for it.
  check((await owner('/api/notice?cafe=' + cafe.id).then(r => r.json())), { notice: null });
  check((await hub('POST', '/internal/notice', { text: '  Try   CHTH Pro ', url: 'https://chth.example/pro' })).json, { ok: true });
  check(await owner('/api/notice?cafe=' + cafe.id).then(r => r.json()), { notice: { text: 'Try CHTH Pro', url: 'https://chth.example/pro' } });
  check((await hub('POST', `/internal/cafes/${cafe.id}/notice`, { mode: 'custom', text: '' })).status, 400);
  await hub('POST', `/internal/cafes/${cafe.id}/notice`, { mode: 'custom', text: 'Beans only', url: '' });
  check(await owner('/api/notice?cafe=' + cafe.id).then(r => r.json()), { notice: { text: 'Beans only', url: null } });
  await hub('POST', `/internal/cafes/${cafe.id}/notice`, { mode: 'none' });
  check(await owner('/api/notice?cafe=' + cafe.id).then(r => r.json()), { notice: null });
  check((await hub('GET', '/internal/cafes')).json.accounts[0].cafes[0].notice, 'none');
  check(await owner('/api/notice?cafe=other').then(r => r.json()), { notice: { text: 'Try CHTH Pro', url: 'https://chth.example/pro' } });
  await hub('POST', `/internal/cafes/${cafe.id}/notice`, { mode: 'global' });
  check(await owner('/api/notice?cafe=' + cafe.id).then(r => r.json()), { notice: { text: 'Try CHTH Pro', url: 'https://chth.example/pro' } });
  // Renaming and updating a café with the owner's saved access; the café still asks the owner site.
  check((await hub('POST', `/internal/cafes/${cafe.id}/rename`, { name: '' })).status, 400);
  check((await hub('POST', `/internal/cafes/${cafe.id}/rename`, { name: 'Corner Beans HQ' })).json, { ok: true });
  assert.match(await (await owner('/dashboard')).text(), /Corner Beans HQ/); checks++;
  check((await hub('POST', `/internal/cafes/${cafe.id}/deploy`)).json.ok, true);
  check(scripts.at(-1).metadata.bindings.find(binding => binding.name === 'PLATFORM_URL').text, HOST);
  check(scripts.at(-1).metadata.bindings.some(binding => binding.name === 'SETUP_TOKEN'), false);
  check((await hub('POST', `/internal/cafes/${cafe.id}/delete`, { confirm: 'wrong' })).status, 400);
  check((await hub('POST', '/internal/cafes/nope/forget')).status, 404);

  // Sign in with Cloudflare: PKCE, and a single-use state bound to the browser that started it.
  const stranger = browser();
  response = await stranger('/connect/oauth');
  const authorize = new URL(response.headers.get('location'));
  check([authorize.origin + authorize.pathname, authorize.searchParams.get('client_id'), authorize.searchParams.get('code_challenge_method')], ['https://dash.cloudflare.com/oauth2/auth', 'test-client', 'S256']);
  check(authorize.searchParams.get('scope').split(' ').sort(), ['account-settings.read', 'd1.write', 'workers-kv-storage.write', 'workers-routes.write', 'workers-scripts.edit', 'zone.read']);
  check(authorize.searchParams.get('redirect_uri'), `${HOST}/connect/oauth/callback`);
  issuedChallenge = authorize.searchParams.get('code_challenge');
  const state = authorize.searchParams.get('state');
  // Another browser cannot use the state, and its attempt does not use it up.
  check((await browser()(`/connect/oauth/callback?state=${state}&code=good-code`)).headers.get('location'), '/?error=oauth');
  check((await stranger(`/connect/oauth/callback?state=forged&code=good-code`)).headers.get('location'), '/?error=oauth');
  check((await stranger(`/connect/oauth/callback?state=${state}&code=good-code`)).headers.get('location'), '/dashboard?done=connected');
  check((await stranger(`/connect/oauth/callback?state=${state}&code=good-code`)).headers.get('location'), '/?error=oauth');
  const strangerCsrf = await csrfOf(await stranger('/dashboard'));

  // Another account cannot see or touch the café.
  check((await stranger(`/cafes/${cafe.id}/deploy`, { csrf: strangerCsrf })).status, 404);
  check((await stranger(`/cafes/${cafe.id}/delete`)).status, 404);
  check((await stranger(`/cafes/${cafe.id}/deploy`, { csrf })).status, 403);

  const oauthRow = await db.prepare("SELECT * FROM connections WHERE method = 'oauth'").first();
  assert.ok(oauthRow && !oauthRow.credentials.includes('oauth-access')); checks++;
  // Rows are bound to their owner: swapping credentials between owners does not decrypt.
  await db.prepare('UPDATE connections SET credentials = ? WHERE owner_id = ?').bind(oauthRow.credentials, connection.owner_id).run();
  response = await owner(`/cafes/${cafe.id}/deploy`, { csrf });
  check(response.status, 502);
  assert.match(await response.text(), /cannot be read/); checks++;
  await db.prepare('UPDATE connections SET credentials = ? WHERE owner_id = ?').bind(connection.credentials, connection.owner_id).run();
  // A grant without Workers Scripts Write (Workers Editor only) is told to use an API token before
  // anything is created, instead of Cloudflare refusing the asset upload halfway through a deploy.
  grantedScope = 'workers-scripts.edit workers-kv-storage.write d1.write account-settings.read';
  const legacy = browser();
  const legacyAuthorize = new URL((await legacy('/connect/oauth')).headers.get('location'));
  issuedChallenge = legacyAuthorize.searchParams.get('code_challenge');
  check((await legacy(`/connect/oauth/callback?state=${legacyAuthorize.searchParams.get('state')}&code=good-code`)).headers.get('location'), '/dashboard?done=connected');
  const uploadsBefore = calls.filter(call => /assets-upload-session/.test(call.path || '')).length;
  response = await legacy('/cafes', { csrf: await csrfOf(await legacy('/dashboard')), name: 'Legacy Grant', demo: '1' });
  check(response.status, 502);
  assert.match(await response.text(), /sign in with an API token instead/); checks++;
  check(calls.filter(call => /assets-upload-session/.test(call.path || '')).length, uploadsBefore);
  await db.prepare("DELETE FROM cafes WHERE script_name = 'cafe-legacy-grant'").run();
  grantedScope = 'workers-scripts.write workers-kv-storage.write d1.write account-settings.read';
  // When Cloudflare refuses the sign-in, the page says why.
  const refusedBrowser = browser();
  const refusedAuthorize = new URL((await refusedBrowser('/connect/oauth')).headers.get('location'));
  response = await refusedBrowser(`/connect/oauth/callback?state=${refusedAuthorize.searchParams.get('state')}&error=invalid_scope&error_description=${encodeURIComponent("The OAuth 2.0 Client is not allowed to request scope 'x'.")}`);
  check(response.status, 400);
  assert.match(await response.text(), /not allowed to request scope &#39;x&#39;/); checks++;
  // Disconnecting revokes the OAuth grant and signs the account out.
  check((await stranger('/disconnect', { csrf: strangerCsrf })).headers.get('location'), '/?done=disconnected');
  check(calls.find(call => call.path === '/oauth2/revoke').token, 'oauth-refresh');
  check((await stranger('/dashboard')).headers.get('location'), '/');

  // Deleting needs the Worker name typed out, then removes the Worker, database and namespace.
  check((await owner(`/cafes/${cafe.id}/delete`, { csrf, confirm: 'wrong' })).status, 400);
  check(calls.some(call => call.method === 'DELETE'), false);
  check((await owner(`/cafes/${cafe.id}/delete`, { csrf, confirm: 'cafe-corner-beans' })).headers.get('location'), '/dashboard?done=deleted');
  check(calls.filter(call => call.method === 'DELETE').map(call => call.path), ['/accounts/acc1/workers/scripts/cafe-corner-beans', '/accounts/acc1/d1/database/db-1', '/accounts/acc1/storage/kv/namespaces/kv-1']);
  check((await db.prepare('SELECT COUNT(*) AS n FROM cafes').first()).n, 0);
  check((await db.prepare("SELECT action FROM audit_log WHERE owner_id = ? ORDER BY id").bind(connection.owner_id).all()).results.map(row => row.action), ['connect', 'deploy', 'setup-link', 'update', 'connect', 'admin:notice', 'admin:notice', 'admin:notice', 'admin:rename', 'admin:update', 'deploy-failed', 'delete']);

  check((await owner('/signout', { csrf })).headers.get('location'), '/');
  check((await owner('/dashboard')).headers.get('location'), '/');

  // Removing an account from the platform forgets it and signs every browser out.
  check((await hub('POST', '/internal/accounts/acc1/remove')).json, { ok: true });
  check((await colleague('/dashboard')).headers.get('location'), '/');
  check((await db.prepare("SELECT COUNT(*) AS n FROM connections WHERE owner_id = 'acc1'").first()).n, 0);
  console.log(`Passed ${checks} control plane assertions.`);
} finally {
  await mf.dispose();
}
