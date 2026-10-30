import type { Context, Hono } from 'hono';
import { getSignedCookie, setSignedCookie } from 'hono/cookie';
import type { Env } from '../server';
import { ensureBaseSchema } from './baseSchema';
import { bytesToBase64, hashPassword, safeEqual, verifyPassword } from '../utils/passwords';

type Workspace = 'admin' | 'panel';
type Bindings = Env['Bindings'];

const SESSION_HOURS = 8;
const MIN_PASSWORD = 10;

const ready = new WeakMap<object, Promise<void>>();
function ensureCredentialTables(db: D1Database) {
  let pending = ready.get(db);
  if (!pending) {
    pending = db.batch([
      db.prepare('CREATE TABLE IF NOT EXISTS workspace_credentials (workspace TEXT PRIMARY KEY, password_hash TEXT NOT NULL, updated_at TEXT NOT NULL)'),
      db.prepare('CREATE TABLE IF NOT EXISTS app_secrets (name TEXT PRIMARY KEY, value TEXT NOT NULL)')
    ]).then(() => {});
    ready.set(db, pending);
    pending.catch(() => ready.delete(db));
  }
  return pending;
}

/** Deployments that set ADMIN_PASSWORD or PANEL_PASSWORD keep using them; others store passwords chosen at setup. */
export const usesSecretPasswords = (env: Bindings) => Boolean(env.ADMIN_PASSWORD || env.PANEL_PASSWORD);

async function storedHash(db: D1Database, workspace: Workspace) {
  await ensureCredentialTables(db);
  const row = await db.prepare('SELECT password_hash FROM workspace_credentials WHERE workspace = ?').bind(workspace).first<{ password_hash: string }>();
  return row?.password_hash ?? null;
}

export async function setupRequired(env: Bindings) {
  return !usesSecretPasswords(env) && Boolean(env.DB) && !(await storedHash(env.DB, 'admin'));
}

const secretCache = new WeakMap<object, Promise<string>>();
/**
 * Without a SESSION_SECRET binding, the Worker generates one on first use and keeps it in D1,
 * so a fresh deployment needs no secrets beyond its setup token.
 */
export async function withSessionSecret(env: Bindings): Promise<Bindings> {
  if (env.SESSION_SECRET || !env.DB) return env;
  let pending = secretCache.get(env.DB);
  if (!pending) {
    pending = (async () => {
      await ensureCredentialTables(env.DB);
      const generated = bytesToBase64(crypto.getRandomValues(new Uint8Array(32)));
      // INSERT OR IGNORE keeps whichever request created it first, so every isolate agrees.
      await env.DB.prepare('INSERT OR IGNORE INTO app_secrets (name, value) VALUES (?, ?)').bind('session_secret', generated).run();
      const row = await env.DB.prepare('SELECT value FROM app_secrets WHERE name = ?').bind('session_secret').first<{ value: string }>();
      return row!.value;
    })();
    secretCache.set(env.DB, pending);
    pending.catch(() => secretCache.delete(env.DB));
  }
  try {
    return { ...env, SESSION_SECRET: await pending };
  } catch (error) {
    // Sign-in and order tracking report the missing secret; public pages keep working.
    console.warn('Session secret unavailable:', error);
    return env;
  }
}

/** Counts failed attempts per workspace and address; returns a response once the limit is reached. */
async function throttled(c: Context<Env>, action: string) {
  const key = `${action}:${c.get('workspace')}:${c.req.header('CF-Connecting-IP') || 'local'}`;
  const attempts = Number(await c.env.KV.get(key) || 0);
  return {
    blocked: attempts >= 10 ? c.json({ success: false, message: 'Too many attempts. Try again in 15 minutes.' }, 429) : null,
    fail: () => c.env.KV.put(key, String(attempts + 1), { expirationTtl: 900 }),
    clear: () => c.env.KV.delete(key)
  };
}

export async function startSession(c: Context<Env>, workspace: Workspace) {
  const sessionId = crypto.randomUUID();
  const expires = String(Date.now() + SESSION_HOURS * 3600000);
  await c.env.KV.put(`session:${workspace}:${sessionId}`, expires, { expirationTtl: SESSION_HOURS * 3600 });
  await setSignedCookie(c, `cafe_${workspace}_session`, `${sessionId}:${expires}`, c.env.SESSION_SECRET!, {
    httpOnly: true, secure: new URL(c.req.url).protocol === 'https:', sameSite: 'Strict', path: '/', maxAge: SESSION_HOURS * 3600
  });
}

/** Signs out every device of a workspace, except the session making the request. */
async function endSessions(c: Context<Env>, workspace: Workspace) {
  const own = await getSignedCookie(c, c.env.SESSION_SECRET!, `cafe_${workspace}_session`);
  const keep = typeof own === 'string' ? `session:${workspace}:${own.split(':')[0]}` : '';
  let cursor: string | undefined;
  do {
    const page = await c.env.KV.list({ prefix: `session:${workspace}:`, cursor });
    await Promise.all(page.keys.filter(key => key.name !== keep).map(key => c.env.KV.delete(key.name)));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
}

function passwordProblem(admin: unknown, panel: unknown) {
  if (typeof admin !== 'string' || typeof panel !== 'string' || admin.length < MIN_PASSWORD || panel.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters for each password.`;
  if (admin.length > 200 || panel.length > 200) return 'Passwords can be up to 200 characters.';
  if (admin === panel) return 'The admin and panel passwords must be different.';
  return null;
}

/** Checks a sign-in password against the Worker secrets or the stored passwords. */
export async function login(c: Context<Env>, password: string) {
  const workspace = c.get('workspace');
  if (!c.env.SESSION_SECRET || !c.env.KV) return c.json({ success: false, message: 'Set SESSION_SECRET and the KV binding on the server first.' }, 503);
  let expected: string | null;
  if (usesSecretPasswords(c.env)) {
    expected = (workspace === 'panel' ? c.env.PANEL_PASSWORD : c.env.ADMIN_PASSWORD) || null;
    if (!expected) return c.json({ success: false, message: `Set ${workspace === 'panel' ? 'PANEL_PASSWORD' : 'ADMIN_PASSWORD'} and SESSION_SECRET on the server first.` }, 503);
    if (c.env.ADMIN_PASSWORD === c.env.PANEL_PASSWORD) return c.json({ success: false, message: 'Admin and panel passwords must be different.' }, 503);
  } else {
    if (!c.env.DB) return c.json({ success: false, message: 'The café database is not configured.' }, 503);
    expected = await storedHash(c.env.DB, workspace);
    if (!expected) return c.json({ success: false, setupRequired: true, message: workspace === 'panel' ? 'Finish setting up the café in the admin first.' : 'Finish setting up the café first.' }, 409);
  }
  const attempts = await throttled(c, 'login');
  if (attempts.blocked) return attempts.blocked;
  const valid = usesSecretPasswords(c.env) ? await safeEqual(password, expected) : await verifyPassword(password, expected);
  if (!valid) {
    await attempts.fail();
    return c.json({ success: false, message: 'Incorrect password.' }, 401);
  }
  await attempts.clear();
  await startSession(c, workspace);
  return c.json({ success: true });
}

export function registerCredentials(app: Hono<Env>) {
  // First run: the owner proves they hold the deployment's SETUP_TOKEN and chooses both passwords.
  app.post('/api/auth/setup', async c => {
    if (c.get('workspace') !== 'admin') return c.json({ success: false, message: 'Set up the café from the admin.' }, 403);
    if (!c.env.DB || !c.env.KV || !c.env.SESSION_SECRET) return c.json({ success: false, message: 'The café database is not configured.' }, 503);
    if (!(await setupRequired(c.env))) return c.json({ success: false, message: 'This café is already set up. Sign in instead.' }, 409);
    if (!c.env.SETUP_TOKEN) return c.json({ success: false, message: 'Set the SETUP_TOKEN secret on the Worker, then try again.' }, 503);
    const attempts = await throttled(c, 'setup');
    if (attempts.blocked) return attempts.blocked;
    const body = await c.req.json();
    if (typeof body.token !== 'string' || !(await safeEqual(body.token.trim(), c.env.SETUP_TOKEN))) {
      await attempts.fail();
      return c.json({ success: false, message: 'The setup code is not valid for this café.' }, 401);
    }
    const problem = passwordProblem(body.adminPassword, body.panelPassword);
    if (problem) return c.json({ success: false, message: problem }, 400);
    const now = new Date().toISOString();
    const insert = 'INSERT INTO workspace_credentials (workspace, password_hash, updated_at) VALUES (?, ?, ?)';
    try {
      await c.env.DB.batch([
        c.env.DB.prepare(insert).bind('admin', await hashPassword(body.adminPassword), now),
        c.env.DB.prepare(insert).bind('panel', await hashPassword(body.panelPassword), now)
      ]);
    } catch (error) {
      // Another request finished setup first.
      if (String(error).includes('UNIQUE')) return c.json({ success: false, message: 'This café is already set up. Sign in instead.' }, 409);
      throw error;
    }
    await attempts.clear();
    if (typeof body.cafeName === 'string' && body.cafeName.trim()) {
      await ensureBaseSchema(c.env.DB);
      await c.env.DB.prepare('UPDATE settings SET cafe_name = ?, updated_at = ? WHERE id = ?').bind(body.cafeName.trim().slice(0, 100), now, 'cafe_config').run().catch(() => {});
    }
    await startSession(c, 'admin');
    return c.json({ success: true });
  });

  app.put('/api/auth/password', async c => {
    if (c.get('workspace') !== 'admin') return c.json({ success: false, message: 'This action requires the admin workspace.' }, 403);
    if (usesSecretPasswords(c.env)) return c.json({ success: false, message: 'Passwords on this café are Worker secrets. Change ADMIN_PASSWORD or PANEL_PASSWORD instead.' }, 409);
    const body = await c.req.json();
    const workspace: Workspace | null = body.workspace === 'admin' || body.workspace === 'panel' ? body.workspace : null;
    if (!workspace) return c.json({ success: false, message: 'Choose the admin or panel password.' }, 400);
    const attempts = await throttled(c, 'password');
    if (attempts.blocked) return attempts.blocked;
    const adminHash = await storedHash(c.env.DB, 'admin');
    if (!adminHash || typeof body.currentPassword !== 'string' || !(await verifyPassword(body.currentPassword, adminHash))) {
      await attempts.fail();
      return c.json({ success: false, message: 'The current admin password is incorrect.' }, 401);
    }
    await attempts.clear();
    if (typeof body.newPassword !== 'string' || body.newPassword.length < MIN_PASSWORD || body.newPassword.length > 200) return c.json({ success: false, message: `Use ${MIN_PASSWORD} to 200 characters.` }, 400);
    const other = await storedHash(c.env.DB, workspace === 'admin' ? 'panel' : 'admin');
    if (other && await verifyPassword(body.newPassword, other)) return c.json({ success: false, message: 'The admin and panel passwords must be different.' }, 400);
    await c.env.DB.prepare('INSERT INTO workspace_credentials (workspace, password_hash, updated_at) VALUES (?, ?, ?) ON CONFLICT(workspace) DO UPDATE SET password_hash = excluded.password_hash, updated_at = excluded.updated_at')
      .bind(workspace, await hashPassword(body.newPassword), new Date().toISOString()).run();
    await endSessions(c, workspace);
    return c.json({ success: true });
  });
}
