import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { Miniflare, Log, LogLevel, convertV4MiniflareOptions } from 'miniflare';

// The control plane against a fake Cloudflare API: it must create, update and delete a café with the
// same calls wrangler makes, keep credentials encrypted, and never let one owner reach another's café.
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
const ok = result => Response.json({ success: true, errors: [], result });
async function cloudflare(request) {
  const url = new URL(request.url);
  if (url.hostname === 'dash.cloudflare.com' && url.pathname === '/oauth2/token') {
    const form = new URLSearchParams(await request.text());
    calls.push({ method: 'POST', path: '/oauth2/token', grant: form.get('grant_type') });
    const challenge = createHash('sha256').update(form.get('code_verifier') || '').digest('base64url');
    if (form.get('code') !== 'good-code' || challenge !== issuedChallenge || form.get('client_id') !== 'test-client') return Response.json({ error: 'invalid_grant' }, { status: 400 });
    return Response.json({ access_token: 'oauth-access', refresh_token: 'oauth-refresh', expires_in: 3600, scope: 'workers:write d1:write' });
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
  if (route === 'GET /accounts') return ok([{ id: 'acc1', name: 'Corner Beans Ltd' }]);
  if (route === 'GET /accounts/acc1/workers/scripts' || route === 'GET /accounts/acc1/d1/database' || route === 'GET /accounts/acc1/storage/kv/namespaces') return ok([]);
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
  bindings: { ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'), CF_OAUTH_CLIENT_ID: 'test-client' },
  serviceBindings: { RELEASE: request => { const file = releaseFiles[new URL(request.url).pathname.slice(1)]; return file === undefined ? new Response('missing', { status: 404 }) : new Response(file); } },
  outboundService: cloudflare
}));
let checks = 0;
const check = (actual, expected) => { assert.deepEqual(actual, expected); checks++; };
const HOST = 'https://cloud.example.com';
const browser = () => {
  let cookie = '';
  return async (path, form, headers = {}) => {
    const response = await mf.dispatchFetch(`${HOST}${path}`, {
      method: form ? 'POST' : 'GET', redirect: 'manual',
      headers: { Cookie: cookie, Origin: HOST, ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}), ...headers },
      ...(form ? { body: new URLSearchParams(form).toString() } : {})
    });
    const set = response.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
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
  check((await browser()('/signup', { email: 'null@example.com', password: 'a-long-owner-password' }, { Origin: 'null' })).status, 403);
  check((await owner('/dashboard')).headers.get('location'), '/signin');
  check((await owner('/signup', { email: 'owner@example.com', password: 'short' })).status, 400);
  response = await owner('/signup', { email: 'Owner@Example.com', password: 'a-long-owner-password' });
  check([response.status, response.headers.get('location')], [303, '/dashboard']);
  check((await browser()('/signup', { email: 'owner@example.com', password: 'another-long-password' })).status, 409);
  response = await owner('/dashboard');
  const page = await response.text();
  assert.match(page, /Connect your Cloudflare account/); checks++;
  assert.match(page, /permissionGroupKeys=/); checks++;
  const csrf = /name="csrf" value="([^"]+)"/.exec(page)[1];

  // Forms need the session's CSRF token and this origin.
  check((await owner('/connect/token', { token: 'api-token' })).status, 403);
  check((await owner('/connect/token', { token: 'api-token', csrf }, { Origin: 'https://evil.example' })).status, 403);
  check((await owner('/connect/token', { token: 'wrong-token', csrf })).status, 400);
  response = await owner('/connect/token', { token: 'api-token', csrf });
  check(response.headers.get('location'), '/dashboard?done=connected');
  const db = await mf.getD1Database('DB');
  const connection = await db.prepare('SELECT * FROM connections').first();
  check([connection.method, connection.account_id, connection.account_name], ['token', 'acc1', 'Corner Beans Ltd']);
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
  check(first.metadata.bindings, [
    { type: 'd1', name: 'DB', id: 'db-1' },
    { type: 'kv_namespace', name: 'KV', namespace_id: 'kv-1' },
    { type: 'assets', name: 'ASSETS' },
    { type: 'plain_text', name: 'CAFE_WORKSPACE_PATHS', text: 'true' },
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

  // Another owner cannot see or touch the café.
  const stranger = browser();
  await stranger('/signup', { email: 'stranger@example.com', password: 'a-long-stranger-password' });
  const strangerCsrf = await csrfOf(await stranger('/dashboard'));
  check((await stranger(`/cafes/${cafe.id}/deploy`, { csrf: strangerCsrf })).status, 404);
  check((await stranger(`/cafes/${cafe.id}/delete`)).status, 404);
  check((await stranger(`/cafes/${cafe.id}/deploy`, { csrf })).status, 403);

  // Connect with Cloudflare: PKCE, a single-use state bound to the owner, encrypted tokens, revoked on disconnect.
  response = await stranger('/connect/oauth');
  const authorize = new URL(response.headers.get('location'));
  check([authorize.origin + authorize.pathname, authorize.searchParams.get('client_id'), authorize.searchParams.get('code_challenge_method')], ['https://dash.cloudflare.com/oauth2/auth', 'test-client', 'S256']);
  assert.match(authorize.searchParams.get('scope'), /offline_access/); checks++;
  check(authorize.searchParams.get('redirect_uri'), `${HOST}/connect/oauth/callback`);
  issuedChallenge = authorize.searchParams.get('code_challenge');
  const state = authorize.searchParams.get('state');
  // Another owner cannot use the state, and their attempt does not use it up.
  check((await owner(`/connect/oauth/callback?state=${state}&code=good-code`)).headers.get('location'), '/dashboard?error=oauth');
  check((await stranger(`/connect/oauth/callback?state=forged&code=good-code`)).headers.get('location'), '/dashboard?error=oauth');
  check((await stranger(`/connect/oauth/callback?state=${state}&code=good-code`)).headers.get('location'), '/dashboard?done=connected');
  check((await stranger(`/connect/oauth/callback?state=${state}&code=good-code`)).headers.get('location'), '/dashboard?error=oauth');
  const oauthRow = await db.prepare("SELECT * FROM connections WHERE method = 'oauth'").first();
  assert.ok(oauthRow && !oauthRow.credentials.includes('oauth-access')); checks++;
  // Rows are bound to their owner: swapping credentials between owners does not decrypt.
  await db.prepare('UPDATE connections SET credentials = ? WHERE owner_id = ?').bind(oauthRow.credentials, connection.owner_id).run();
  response = await owner(`/cafes/${cafe.id}/deploy`, { csrf });
  check(response.status, 502);
  assert.match(await response.text(), /cannot be read/); checks++;
  await db.prepare('UPDATE connections SET credentials = ? WHERE owner_id = ?').bind(connection.credentials, connection.owner_id).run();
  check((await stranger('/disconnect', { csrf: strangerCsrf })).headers.get('location'), '/dashboard?done=disconnected');
  check(calls.find(call => call.path === '/oauth2/revoke').token, 'oauth-refresh');

  // Deleting needs the Worker name typed out, then removes the Worker, database and namespace.
  check((await owner(`/cafes/${cafe.id}/delete`, { csrf, confirm: 'wrong' })).status, 400);
  check(calls.some(call => call.method === 'DELETE'), false);
  check((await owner(`/cafes/${cafe.id}/delete`, { csrf, confirm: 'cafe-corner-beans' })).headers.get('location'), '/dashboard?done=deleted');
  check(calls.filter(call => call.method === 'DELETE').map(call => call.path), ['/accounts/acc1/workers/scripts/cafe-corner-beans', '/accounts/acc1/d1/database/db-1', '/accounts/acc1/storage/kv/namespaces/kv-1']);
  check((await db.prepare('SELECT COUNT(*) AS n FROM cafes').first()).n, 0);
  check((await db.prepare("SELECT action FROM audit_log WHERE owner_id = ? ORDER BY id").bind(connection.owner_id).all()).results.map(row => row.action), ['connect', 'deploy', 'setup-link', 'update', 'deploy-failed', 'delete']);

  check((await owner('/signout', { csrf })).headers.get('location'), '/');
  check((await owner('/dashboard')).headers.get('location'), '/signin');
  console.log(`Passed ${checks} control plane assertions.`);
} finally {
  await mf.dispose();
}
