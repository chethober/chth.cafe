import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare, Log, LogLevel, convertV4MiniflareOptions } from 'miniflare';

// A deployment made by the control plane: no password or session secrets, only a setup token, on one workers.dev host.
const bundle = await build({ entryPoints: ['src/server.ts'], bundle: true, format: 'esm', platform: 'browser', loader: { '.sql': 'text' }, write: false });
const mf = new Miniflare(convertV4MiniflareOptions({
  log: new Log(LogLevel.NONE), modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2025-01-01',
  d1Databases: { DB: 'setup-cafe' }, kvNamespaces: ['KV'],
  bindings: { SETUP_TOKEN: 'test-setup-token', CAFE_WORKSPACE_PATHS: 'true' }
}));
let checks = 0;
const check = (actual, expected) => { assert.deepEqual(actual, expected); checks++; };
const HOST = 'https://cafe.example.workers.dev';
const request = (path, { body, method, cookie = '', workspace } = {}) => mf.dispatchFetch(`${HOST}${path}`, {
  method: method || (body === undefined ? 'GET' : 'POST'),
  headers: { 'Content-Type': 'application/json', Cookie: cookie, ...(workspace ? { 'X-Cafe-Workspace': workspace } : {}) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) })
});
const cookieOf = response => response.headers.get('set-cookie').split(';')[0];
try {
  // The database starts empty: the Worker creates its own tables from schema.sql.
  const db = await mf.getD1Database('DB');

  let session = await (await request('/api/auth/session')).json();
  check(session.setupRequired, true);
  check(session.authenticated, false);
  let response = await request('/api/auth/login', { body: { password: 'anything-at-all' } });
  check(response.status, 409);
  check((await response.json()).setupRequired, true);
  check((await request('/api/auth/login', { body: { password: 'anything-at-all' }, workspace: 'panel' })).status, 409);

  const setup = { token: 'test-setup-token', cafeName: '  Corner Beans ', adminPassword: 'admin-password-1', panelPassword: 'panel-password-1' };
  check((await request('/api/auth/setup', { body: { ...setup, token: 'wrong' } })).status, 401);
  check((await request('/api/auth/setup', { body: { ...setup, panelPassword: setup.adminPassword } })).status, 400);
  check((await request('/api/auth/setup', { body: { ...setup, panelPassword: 'short' } })).status, 400);
  check((await request('/api/auth/setup', { body: setup, workspace: 'panel' })).status, 403);
  response = await request('/api/auth/setup', { body: setup });
  check(response.status, 200);
  assert.match(response.headers.get('set-cookie'), /cafe_admin_session=.*HttpOnly/i); checks++;
  const adminCookie = cookieOf(response);
  check((await request('/api/auth/setup', { body: setup })).status, 409);
  session = await (await request('/api/auth/session', { cookie: adminCookie })).json();
  check([session.authenticated, session.workspace, session.setupRequired], [true, 'admin', false]);
  check((await (await request('/api/settings')).json()).data.cafeName, 'Corner Beans');
  // A fresh café starts without the demo menu, staff or orders.
  const menu = await (await request('/api/menu')).json();
  check([menu.source, menu.data.length], ['d1_database', 0]);
  check((await db.prepare('SELECT COUNT(*) AS n FROM staff').first()).n, 0);
  // The Worker generated its own session secret and kept it, so sessions survive new isolates.
  check((await db.prepare("SELECT COUNT(*) AS n FROM app_secrets WHERE name = 'session_secret'").first()).n, 1);
  // Passwords are stored as salted PBKDF2 hashes, never as text.
  for (const row of (await db.prepare('SELECT password_hash FROM workspace_credentials').all()).results) {
    assert.match(row.password_hash, /^pbkdf2\$25000\$/); assert.ok(!row.password_hash.includes('password-1')); checks += 2;
  }

  // The panel shares the origin; its header picks the panel session, which still only reaches panel routes.
  check((await request('/api/auth/login', { body: { password: setup.adminPassword }, workspace: 'panel' })).status, 401);
  response = await request('/api/auth/login', { body: { password: setup.panelPassword }, workspace: 'panel' });
  check(response.status, 200);
  const panelCookie = cookieOf(response);
  assert.match(panelCookie, /^cafe_panel_session=/); checks++;
  check((await request('/api/orders', { cookie: panelCookie, workspace: 'panel' })).status, 200);
  check((await request('/api/admin/settings', { cookie: panelCookie, workspace: 'panel' })).status, 403);
  check((await request('/api/orders', { cookie: panelCookie })).status, 401);
  check((await request('/api/admin/settings', { cookie: adminCookie })).status, 200);
  check((await request('/api/auth/login', { body: { password: setup.adminPassword } })).status, 200);

  // Changing a password needs the admin password and signs out that workspace's other devices.
  const change = { workspace: 'panel', currentPassword: setup.adminPassword, newPassword: 'panel-password-2' };
  check((await request('/api/auth/password', { body: change, method: 'PUT' })).status, 401);
  check((await request('/api/auth/password', { body: change, method: 'PUT', cookie: panelCookie, workspace: 'panel' })).status, 403);
  check((await request('/api/auth/password', { body: { ...change, currentPassword: 'wrong-password' }, method: 'PUT', cookie: adminCookie })).status, 401);
  check((await request('/api/auth/password', { body: { ...change, newPassword: setup.adminPassword }, method: 'PUT', cookie: adminCookie })).status, 400);
  check((await request('/api/auth/password', { body: change, method: 'PUT', cookie: adminCookie })).status, 200);
  check((await request('/api/orders', { cookie: panelCookie, workspace: 'panel' })).status, 401);
  check((await request('/api/auth/login', { body: { password: setup.panelPassword }, workspace: 'panel' })).status, 401);
  check((await request('/api/auth/login', { body: { password: 'panel-password-2' }, workspace: 'panel' })).status, 200);
  check((await request('/api/admin/settings', { cookie: adminCookie })).status, 200);

  // /admin and /panel open the app here instead of returning 404.
  for (const path of ['/admin', '/admin/settings', '/panel']) assert.notEqual((await request(path)).status, 404), checks++;
  console.log(`Passed ${checks} first-run setup and path workspace assertions.`);
} finally {
  await mf.dispose();
}
