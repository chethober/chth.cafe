import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { Miniflare, Log, LogLevel, convertV4MiniflareOptions } from 'miniflare';

// The packaged release is what the control plane uploads; its single-module Worker must run on its own.
if (!existsSync('dist/index.html')) execFileSync('npm', ['run', 'build'], { stdio: 'inherit' });
execFileSync('node', ['scripts/package-release.mjs'], { stdio: 'inherit' });
const manifest = JSON.parse(readFileSync('release/manifest.json', 'utf8'));
let checks = 0;
const check = (actual, expected) => { assert.deepEqual(actual, expected); checks++; };
assert.match(manifest.version, /^\d+\.\d+\.\d+-\d{8}\.[0-9a-f]{7}$/); checks++;
check([manifest.mainModule, manifest.crons, manifest.runWorkerFirst], ['server.js', ['0 * * * *'], true]);
assert.ok(manifest.assets['/index.html'] && !manifest.assets['/_redirects']); checks++;
for (const [path, asset] of Object.entries(manifest.assets)) {
  check(readFileSync(`release/assets${path}`).length, asset.size);
  assert.match(asset.hash, /^[0-9a-f]{32}$/); checks++;
}
const mf = new Miniflare(convertV4MiniflareOptions({
  log: new Log(LogLevel.NONE), modules: true, scriptPath: 'release/server.js', compatibilityDate: manifest.compatibilityDate, compatibilityFlags: manifest.compatibilityFlags,
  d1Databases: { DB: 'release-cafe' }, kvNamespaces: ['KV'], bindings: { SETUP_TOKEN: 'release-setup-token', CAFE_WORKSPACE_PATHS: 'true', PLATFORM_URL: 'https://cloud.example.com', PLATFORM_CAFE_ID: 'cafe-1' },
  // The control plane's notice line, the only request a café makes to it.
  outboundService: request => {
    const url = new URL(request.url);
    assert.equal(`${url.origin}${url.pathname}?${url.searchParams}`, 'https://cloud.example.com/api/notice?cafe=cafe-1');
    platformCalls++;
    return Response.json({ notice: { text: 'Try CHTH Pro', url: 'javascript:alert(1)' } });
  }
}));
let platformCalls = 0;
try {
  const session = await (await mf.dispatchFetch('https://cafe.owner.workers.dev/api/auth/session')).json();
  check([session.authenticated, session.setupRequired], [false, true]);
  const setup = await mf.dispatchFetch('https://cafe.owner.workers.dev/api/auth/setup', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'release-setup-token', adminPassword: 'admin-password-1', panelPassword: 'panel-password-1' })
  });
  check(setup.status, 200);
  check((await (await mf.dispatchFetch('https://cafe.owner.workers.dev/api/settings')).json()).data.cafeName, 'My café');
  // Shown to signed-out pages too, without a link that is not https, and fetched once per isolate.
  check(await (await mf.dispatchFetch('https://cafe.owner.workers.dev/api/platform-notice')).json(), { notice: { text: 'Try CHTH Pro', url: null } });
  await mf.dispatchFetch('https://cafe.owner.workers.dev/api/platform-notice');
  check(platformCalls, 1);
  console.log(`Passed ${checks} release package assertions for ${manifest.version}.`);
} finally {
  await mf.dispose();
}
