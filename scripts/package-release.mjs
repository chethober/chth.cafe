// Packages a built café (npm run build) into release/, the versioned bundle the control plane deploys:
//   manifest.json  version, Worker settings, and every asset's hash, size and type
//   server.js      the Worker as a single ES module, schema.sql included
//   assets/        the files from dist/
//   demo.sql       schema.sql with its demo menu, for owners who want to start from it
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
process.chdir(root);
// The hash Cloudflare's asset upload uses, as wrangler computes it; blake3-wasm comes with wrangler.
const { hash: blake3 } = createRequire(import.meta.url)('blake3-wasm');

if (!existsSync('dist/index.html')) throw new Error('Run npm run build first.');
const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8').replace(/^\s*\/\/.*$/gm, ''));
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const git = (...args) => { try { return execFileSync('git', args, { encoding: 'utf8' }).trim(); } catch { return ''; } };
const commit = process.env.GITHUB_SHA || git('rev-parse', 'HEAD') || 'unknown';
const builtAt = new Date().toISOString();
const version = `${pkg.version}-${builtAt.slice(0, 10).replaceAll('-', '')}.${commit.slice(0, 7)}`;

const TYPES = {
  html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8', json: 'application/json', webmanifest: 'application/manifest+json', txt: 'text/plain; charset=utf-8',
  svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', ico: 'image/x-icon',
  woff: 'font/woff', woff2: 'font/woff2', map: 'application/json'
};
// Cloudflare reads these as asset configuration, not as files to serve.
const CONFIG_FILES = new Set(['_redirects', '_headers', '.assetsignore']);

rmSync('release', { recursive: true, force: true });
mkdirSync('release');
cpSync('dist', 'release/assets', { recursive: true });

const assets = {};
const walk = dir => readdirSync(dir).flatMap(name => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : [path];
});
for (const file of walk('dist')) {
  const path = '/' + relative('dist', file).split(sep).join('/');
  if (CONFIG_FILES.has(path.slice(1))) continue;
  const contents = readFileSync(file);
  const extension = extname(file).slice(1);
  assets[path] = {
    hash: blake3(contents.toString('base64') + extension).toString('hex').slice(0, 32),
    size: contents.length,
    contentType: TYPES[extension.toLowerCase()] || 'application/octet-stream'
  };
}

const worker = await build({
  entryPoints: [config.main], bundle: true, format: 'esm', platform: 'browser', target: 'es2022',
  conditions: ['workerd', 'worker', 'browser'], loader: { '.sql': 'text' }, minify: true, write: false
});
writeFileSync('release/server.js', worker.outputFiles[0].contents);
cpSync('schema.sql', 'release/demo.sql');

const manifest = {
  name: config.name,
  version,
  commit,
  builtAt,
  mainModule: 'server.js',
  compatibilityDate: config.compatibility_date,
  compatibilityFlags: config.compatibility_flags || [],
  runWorkerFirst: config.assets?.run_worker_first === true,
  crons: config.triggers?.crons || [],
  demoSql: 'demo.sql',
  assets
};
writeFileSync('release/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(`Packaged ${version}: ${Object.keys(assets).length} assets, Worker ${(worker.outputFiles[0].contents.length / 1024).toFixed(0)} KiB.`);
