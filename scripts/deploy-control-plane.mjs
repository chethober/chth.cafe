// Deploys the control plane (chth.cafe) from this machine: the same as the Release workflow's
// deploy. The platform admin lives in the CHTH hub's admin bot, so there's no password here.
// Extra arguments go to wrangler deploy.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
execFileSync('npx', ['wrangler', 'deploy', '-c', 'control-plane/wrangler.jsonc', ...process.argv.slice(2)], { stdio: 'inherit' });
