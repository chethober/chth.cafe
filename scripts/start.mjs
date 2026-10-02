import { spawn } from 'node:child_process';
import { existsSync, writeFileSync, readFileSync, chmodSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
process.chdir(root);
const credentials = {
  ADMIN_PASSWORD: randomBytes(24).toString('base64url'),
  PANEL_PASSWORD: randomBytes(24).toString('base64url'),
  SESSION_SECRET: randomBytes(32).toString('hex'),
};
const existing = existsSync('.dev.vars') ? readFileSync('.dev.vars', 'utf8') : '';
const settings = existing.split(/\r?\n/).filter(line =>
  !/^\s*(?:export\s+)?(?:ADMIN_PASSWORD|PANEL_PASSWORD|SESSION_SECRET)\s*=/.test(line)
).join('\n').trimEnd();
writeFileSync('.dev.vars', `${settings ? `${settings}\n` : ''}${Object.entries(credentials).map(([key, value]) => `${key}=${value}`).join('\n')}\n`, { mode: 0o600 });
chmodSync('.dev.vars', 0o600);
console.log(`Local admin password: ${credentials.ADMIN_PASSWORD}\nLocal panel password: ${credentials.PANEL_PASSWORD}`);
const children = new Set();
let stopping = false;
function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  process.exitCode = code;
}
function run(command, args) {
  const child = spawn(command, args, { stdio: 'inherit', cwd: root, env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } });
  children.add(child);
  child.on('error', error => { console.error(error.message); shutdown(1); });
  child.on('exit', code => { children.delete(child); if (!stopping && children.size) shutdown(code || 0); });
  return child;
}
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => shutdown());
if (!existsSync('dist/index.html')) {
  const build = run('npm', ['run','build']);
  const code = await new Promise(resolve => build.once('exit', resolve));
  if (code !== 0) { shutdown(1); process.exit(1); }
}
run('node', ['node_modules/wrangler/bin/wrangler.js','dev','--local','--port','8787','--var','CAFE_DEV_PROXY:true']);
run('node', ['node_modules/vite/bin/vite.js','--port','3000','--strictPort']);
