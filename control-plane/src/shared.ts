import type { Context, MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie } from 'hono/cookie';
import schema from '../schema.sql';
import { CloudflareClient, deployCafe, type CafeResources, type Release } from './cloudflare';
import { decrypt, encrypt } from './crypto';
import { lacksScriptsScope, refresh, type Credentials, type OAuthEnv } from './oauth';
import { applyTheme, THEME_COOKIE, THEME_SWITCH_COOKIE, themeScriptSource } from './design';
import * as views from './views';

/** What the owner site (chth.cafe) and the hub's internal API share. */
export type Bindings = OAuthEnv & {
  DB: D1Database;
  /** The packaged café release (release/ from npm run release), never served to visitors. */
  RELEASE: Fetcher;
  /** 32 random bytes, base64: encrypts the Cloudflare credentials owners connect. */
  ENCRYPTION_KEY: string;
  /** CHTH hub reporting (optional): the hub's URL and this site's own secret. */
  HUB_URL?: string;
  HUB_SECRET?: string;
};

export type ConnectionRow = { owner_id: string; method: 'token' | 'oauth'; account_id: string; account_name: string; credentials: string; created_at: string; updated_at: string };
export type CafeRow = {
  id: string; owner_id: string; account_id: string; name: string; script_name: string; database_id: string | null; kv_namespace_id: string | null;
  custom_domain: string | null; url: string | null; admin_url: string | null; version: string | null; status: 'deploying' | 'live' | 'failed'; last_error: string | null;
  created_at: string; updated_at: string;
};

const ready = new WeakMap<object, Promise<void>>();
export function ensureSchema(db: D1Database) {
  let pending = ready.get(db);
  if (!pending) {
    const statements = schema.replace(/^--.*$/gm, '').replace(/--[^\n]*/g, '').split(';').map(sql => sql.trim()).filter(Boolean);
    pending = db.batch(statements.map(sql => db.prepare(sql))).then(() => {});
    ready.set(db, pending);
    pending.catch(() => ready.delete(db));
  }
  return pending;
}

let releaseCache: Promise<Release> | null = null;
export const releaseFile = (env: Bindings) => (path: string) => env.RELEASE.fetch(new Request(`https://release/${path}`));
export function currentRelease(env: Bindings) {
  releaseCache ??= releaseFile(env)('manifest.json').then(async response => {
    if (!response.ok) throw new Error('The control plane was deployed without a café release. Run npm run release before deploying it.');
    return response.json() as Promise<Release>;
  });
  releaseCache.catch(() => { releaseCache = null; });
  return releaseCache;
}

export const now = () => new Date().toISOString();
export const message = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';
export const audit = (db: D1Database, ownerId: string, action: string, detail = '', cafeId: string | null = null) =>
  db.prepare('INSERT INTO audit_log (owner_id, cafe_id, action, detail, created_at) VALUES (?, ?, ?, ?, ?)').bind(ownerId, cafeId, action, detail.slice(0, 500), now()).run();

/** Allows ten failures per action and address every 15 minutes. */
export async function attempts(c: Context, action: string) {
  const db = (c.env as Bindings).DB;
  const key = `${action}:${c.req.header('CF-Connecting-IP') || 'local'}`;
  const row = await db.prepare('SELECT count FROM attempts WHERE key = ? AND expires_at > ?').bind(key, Date.now()).first<{ count: number }>();
  return {
    blocked: (row?.count ?? 0) >= 10,
    fail: () => db.prepare('INSERT INTO attempts (key, count, expires_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = CASE WHEN expires_at > ? THEN count + 1 ELSE 1 END, expires_at = excluded.expires_at')
      .bind(key, Date.now() + 15 * 60000, Date.now()).run(),
    clear: () => db.prepare('DELETE FROM attempts WHERE key = ?').bind(key).run()
  };
}

/** The owner site's origin, which cafés ask for their notice line. */
export const platformOrigin = (url: string) => new URL(url).origin;

/** A client for the connection's account, refreshing an OAuth access token that is about to expire. */
export async function clientFor(env: Bindings, connection: ConnectionRow) {
  const ownerId = connection.owner_id;
  let credentials = await decrypt<Credentials>(env.ENCRYPTION_KEY, ownerId, connection.credentials).catch(() => {
    throw new Error('The saved Cloudflare access cannot be read. Disconnect and connect your account again.');
  });
  if (lacksScriptsScope(credentials)) {
    throw new Error('Your Cloudflare sign-in is missing permission to upload Workers. Sign out, then sign in with Cloudflare again and approve the new permission.');
  }
  if (credentials.kind === 'oauth' && credentials.expiresAt < Date.now() + 60000) {
    credentials = await refresh(env, credentials);
    await env.DB.prepare('UPDATE connections SET credentials = ?, updated_at = ? WHERE owner_id = ?').bind(await encrypt(env.ENCRYPTION_KEY, ownerId, credentials), now(), ownerId).run();
  }
  return new CloudflareClient(credentials.kind === 'token' ? credentials.token : credentials.accessToken);
}

export const resourcesOf = (cafe: CafeRow): CafeResources => ({
  accountId: cafe.account_id, scriptName: cafe.script_name, databaseId: cafe.database_id, kvNamespaceId: cafe.kv_namespace_id, customDomain: cafe.custom_domain
});

/** Deploys the current release to a café and records the outcome on its row. Throws when Cloudflare refuses. */
export async function deployRow(env: Bindings, requestUrl: string, cafe: CafeRow, connection: ConnectionRow, options: { setupToken?: string; demoData?: boolean } = {}) {
  const release = await currentRelease(env);
  try {
    const result = await deployCafe(await clientFor(env, connection), resourcesOf(cafe), release, releaseFile(env), { ...options, platform: { url: platformOrigin(requestUrl), cafeId: cafe.id } });
    await env.DB.prepare("UPDATE cafes SET database_id = ?, kv_namespace_id = ?, url = ?, admin_url = ?, version = ?, status = 'live', last_error = NULL, updated_at = ? WHERE id = ?")
      .bind(result.databaseId, result.kvNamespaceId, result.url, result.adminUrl, release.version, now(), cafe.id).run();
    return { ...result, version: release.version };
  } catch (error) {
    await env.DB.prepare("UPDATE cafes SET status = CASE WHEN version IS NULL THEN 'failed' ELSE status END, last_error = ?, updated_at = ? WHERE id = ?").bind(message(error).slice(0, 1000), now(), cafe.id).run();
    throw error;
  }
}

/** Pages render without a theme; the saved one is applied here so no view has to know about it. */
export const themed: MiddlewareHandler = async (c, next) => {
  await next();
  if (!c.res.headers.get('Content-Type')?.startsWith('text/html')) return;
  const switched = getCookie(c, THEME_SWITCH_COOKIE) === '1';
  const res = c.res;
  const headers = new Headers(res.headers);
  headers.delete('Content-Length');
  c.res = new Response(applyTheme(await res.text(), getCookie(c, THEME_COOKIE), switched), { status: res.status, headers });
  if (switched) deleteCookie(c, THEME_SWITCH_COOKIE, { path: '/' });
};

/** Creates the tables, sets the security headers, and refuses forms posted from another origin. */
export const guarded: MiddlewareHandler = async (c, next) => {
  await ensureSchema((c.env as Bindings).DB);
  c.header('X-Frame-Options', 'DENY');
  // The only script is the theme toggle, allowed by its hash.
  c.header('Content-Security-Policy', `default-src 'none'; script-src ${await themeScriptSource()}; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; form-action 'self' https://dash.cloudflare.com; frame-ancestors 'none'; base-uri 'none'`);
  // same-origin, not no-referrer: with no-referrer, browsers send "Origin: null" on form posts, which the origin check refuses.
  c.header('Referrer-Policy', 'same-origin');
  if (c.req.method === 'POST') {
    const origin = c.req.header('Origin');
    if (origin && origin !== new URL(c.req.url).origin) return c.html(views.errorPage('This form was sent from another site.'), 403);
  }
  await next();
};
