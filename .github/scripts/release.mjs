// Versions a deploy as vX.Y.Z and publishes it as a GitHub release. The CHTH hub reads the
// releases of this repository and its bot posts each new one to the updates channel, so nothing
// else is needed to announce a release. The same file lives in every CHTH repository.
//
//   node release.mjs plan              works out the version and writes it to the step's outputs
//   node release.mjs publish [files]   creates the tag and the release, with the files attached
//
// The version is the latest vX.Y.Z tag with its patch number raised by one. To start a new minor
// or major version, raise "version" in package.json: a version above the latest tag is used as it
// is. Without a tag yet, the first release is the package's version.
//
// The notes are the commit subjects since the latest tag. A push in which no commit counts
// (only CI, docs or tests changed, or only paths left out below) is not a release: `plan` then
// reports the latest version again with release=false, and `publish` does nothing.
//
//   RELEASE_PREFIX    goes before the tag in a repository of several products: "chthvpnbot-"
//   RELEASE_TITLE     the product's name in the release title (default: the repository's name)
//   RELEASE_PACKAGE   the package.json with the version (default: package.json)
//   RELEASE_PATHS     only commits touching these paths count (default: the directory it runs in)
//   RELEASE_EXCLUDE   paths that never count
//   GH_TOKEN          for `publish`: a token with contents: write
import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const env = (k) => (process.env[k] ?? '').trim();
const git = (...args) => { try { return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; } };
const words = (s) => s.split(/\s+/).filter(Boolean);
const MAX_LINES = 30;

const parse = (v) => { const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(String(v ?? '')); return m ? m.slice(1).map(Number) : null; };
const compare = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/** The next version: the package's when it is above the latest tag, else the next patch. */
export function nextVersion(latest, pkg) {
  if (!latest) return pkg ?? [1, 0, 0];
  return pkg && compare(pkg, latest) > 0 ? pkg : [latest[0], latest[1], latest[2] + 1];
}

function latestTag(prefix) {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const strict = new RegExp(`^${escaped}v(\\d+)\\.(\\d+)\\.(\\d+)$`);
  return git('tag', '--list', `${prefix}v*`).split('\n')
    .map((tag) => ({ tag, version: strict.test(tag) ? parse(tag.slice(prefix.length)) : null }))
    .filter((t) => t.version).sort((a, b) => compare(b.version, a.version))[0] ?? null;
}

function subjects(range) {
  const paths = [
    ...(words(env('RELEASE_PATHS')).length ? words(env('RELEASE_PATHS')) : ['.']),
    ...words(env('RELEASE_EXCLUDE')).map((p) => `:(exclude)${p}`),
    ':(exclude,top).github', ':(exclude)*.md', ':(exclude,glob)**/docs/**', ':(exclude,glob)**/test/**', ':(exclude,glob)**/tests/**',
  ];
  const log = git('log', '--no-merges', '--format=%s', ...range, '--', ...paths);
  return [...new Set(log.split('\n').map((s) => s.replace(/\s*\(#\d+\)$/, '').trim()).filter(Boolean))].reverse();
}

export function plan() {
  git('fetch', '--tags', '--force', '--quiet', 'origin');
  const prefix = env('RELEASE_PREFIX');
  const latest = latestTag(prefix);
  let pkg = null;
  try { pkg = parse(JSON.parse(readFileSync(env('RELEASE_PACKAGE') || 'package.json', 'utf8')).version); } catch { /* no package.json */ }
  // The first release tells what the product is now: its latest commits.
  const list = latest ? subjects([`${latest.tag}..HEAD`]) : subjects(['-10']);
  const release = !latest || list.length > 0;
  const version = (release ? nextVersion(latest?.version, pkg) : latest.version).join('.');
  const lines = list.slice(0, MAX_LINES).map((s) => `- ${s}`);
  if (list.length > MAX_LINES) lines.push(`- …and ${list.length - MAX_LINES} more`);
  return { version, tag: `${prefix}v${version}`, release, notes: lines.join('\n') || '- First release' };
}

function main() {
  const [command, ...files] = process.argv.slice(2);
  const p = plan();
  if (command === 'plan') {
    console.log(p.release ? `Next release: ${p.tag}\n${p.notes}` : `No commit counts since ${p.tag}: not a release.`);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `version=${p.version}\ntag=${p.tag}\nrelease=${p.release}\n`);
    return;
  }
  if (command !== 'publish') throw new Error('Usage: release.mjs plan | publish [files]');
  if (!p.release) return console.log(`No commit counts since ${p.tag}: nothing to release.`);
  const title = `${env('RELEASE_TITLE') || (process.env.GITHUB_REPOSITORY ?? '').split('/').pop() || 'Release'} v${p.version}`;
  const notes = join(mkdtempSync(join(tmpdir(), 'release-')), 'notes.md');
  writeFileSync(notes, `${p.notes}\n`);
  const target = process.env.GITHUB_SHA || git('rev-parse', 'HEAD');
  try {
    execFileSync('gh', ['release', 'create', p.tag, ...files, '--target', target, '--title', title, '--notes-file', notes], { stdio: 'inherit' });
    console.log(`Released ${p.tag}.`);
  } catch (e) {
    // Two pushes close together can work out the same version: the deploy still succeeded.
    if (git('ls-remote', '--tags', 'origin', `refs/tags/${p.tag}`)) return console.log(`::warning::${p.tag} already exists: this push is not released on its own.`);
    throw e;
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) main();
