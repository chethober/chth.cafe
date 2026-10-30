// Deploys the control plane with a new platform admin password, and prints it once.
// Only its SHA-256 goes to Cloudflare, as the ADMIN_PASSWORD_HASH secret of the new version;
// the new password also ends every admin session signed in with the old one.
// Extra arguments go to wrangler deploy.
import { execFileSync } from 'node:child_process';
import { createHash, randomInt } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
// 20 characters from an alphabet without look-alikes: about 100 bits.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const password = Array.from({ length: 20 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('').replace(/(.{5})(?!$)/g, '$1-');
const hash = createHash('sha256').update(password).digest('hex');

const dir = mkdtempSync(join(tmpdir(), 'chth-admin-'));
const secrets = join(dir, 'secrets.json');
writeFileSync(secrets, JSON.stringify({ ADMIN_PASSWORD_HASH: hash }), { mode: 0o600 });
try {
  execFileSync('npx', ['wrangler', 'deploy', '-c', 'control-plane/wrangler.jsonc', '--secrets-file', secrets, ...process.argv.slice(2)], { stdio: 'inherit' });
} finally {
  rmSync(dir, { recursive: true, force: true });
}

const config = JSON.parse(readFileSync('control-plane/wrangler.jsonc', 'utf8').replace(/^\s*\/\/.*$/gm, ''));
const host = config.routes?.find(route => route.pattern.startsWith('admin.'))?.pattern ?? 'admin.<your control plane host>';
console.log(`\nPlatform admin: https://${host}\nPassword for this deploy: ${password}\n(The previous password and its sessions no longer work.)`);
