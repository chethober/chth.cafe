// Generated from the CHTH kit (chth.hub/kit) by `npm run sync`. Do not edit here: edit the kit and sync.
// Talking to the CHTH hub (the private admin bot) over signed HTTP, in both directions:
//   product → hub   POST {HUB_URL}/ingest with events (new users, tips, orders, errors)
//   hub → product   GET/POST {site}/internal/* for stats and admin actions
// Each product has its own secret, shared only with the hub, so a leaked bot secret can't be
// used to forge another product's events. A request carries:
//   X-Chth-Source     the product id (e.g. chthgamesbot, shop, hub)
//   X-Chth-Timestamp  unix seconds; requests more than 5 minutes off are refused
//   X-Chth-Signature  hex HMAC-SHA256(secret, `${timestamp}.${method} ${path}.${body}`)
// Only Web Crypto is used, so this runs in Workers, Node 18+, browsers and Telegram Serverless.
// Events carry counts and ids, never message contents.

const enc = new TextEncoder();
export const MAX_SKEW_SECONDS = 300;

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
}

/** Compares two strings without an early exit. */
export function safeEqual(a, b) {
  a = String(a ?? ''); b = String(b ?? '');
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

/** The signature for one request. `path` is the URL path only, without the query. */
export const signature = (secret, timestamp, method, path, body = '') =>
  hmac(secret, `${timestamp}.${method.toUpperCase()} ${path}.${body}`);

/** Headers for a signed request from `source`. */
export async function signedHeaders({ source, secret, method = 'POST', url, body = '', now = Date.now() }) {
  const ts = String(Math.floor(now / 1000));
  const path = new URL(url).pathname;
  return {
    'X-Chth-Source': source,
    'X-Chth-Timestamp': ts,
    'X-Chth-Signature': await signature(secret, ts, method, path, body),
    ...(body ? { 'Content-Type': 'application/json' } : {}),
  };
}

/**
 * Checks a signed request. `secretFor(source)` returns that source's secret, or null for an
 * unknown source. Resolves to `{ source, body }` (the body as text) or null.
 * @param {Request} request
 * @param {(source: string) => string | null | undefined | Promise<string | null | undefined>} secretFor
 */
export async function verifySigned(request, secretFor, now = Date.now()) {
  const source = request.headers.get('X-Chth-Source') ?? '';
  const ts = Number(request.headers.get('X-Chth-Timestamp'));
  const sig = request.headers.get('X-Chth-Signature') ?? '';
  if (!/^[a-z0-9_.-]{1,40}$/i.test(source) || !Number.isFinite(ts) || !/^[0-9a-f]{64}$/.test(sig)) return null;
  if (Math.abs(now / 1000 - ts) > MAX_SKEW_SECONDS) return null;
  const secret = await secretFor(source);
  if (!secret) return null;
  const body = request.method === 'GET' || request.method === 'HEAD' ? '' : await request.text();
  const expected = await signature(secret, String(ts), request.method, new URL(request.url).pathname, body);
  return safeEqual(expected, sig) ? { source, body, signature: sig, timestamp: ts } : null;
}

/**
 * A stable pseudonymous id for a user, so the hub can count unique users without storing raw
 * Telegram or account ids. Keyed by the product's secret, so ids can't be matched across
 * products or reversed by someone without the secret.
 */
export async function pseudonym(secret, id) {
  return (await hmac(secret, `uid:${id}`)).slice(0, 24);
}

/**
 * A reporter for one product. `track` never throws: when the hub is down or not configured,
 * the product keeps working and the event is only logged.
 * @param {{ url?: string, source: string, secret?: string, fetch?: typeof fetch }} cfg
 */
export function createReporter(cfg) {
  const send = cfg.fetch ?? ((...a) => fetch(...a));
  const enabled = Boolean(cfg.url && cfg.secret);
  async function post(events) {
    if (!enabled || !events.length) return false;
    try {
      const url = `${cfg.url.replace(/\/$/, '')}/ingest`;
      const body = JSON.stringify({ events });
      const res = await send(url, { method: 'POST', headers: await signedHeaders({ source: cfg.source, secret: cfg.secret, url, body }), body });
      if (!res.ok) console.warn('chth hub: ingest refused', res.status);
      return res.ok;
    } catch (e) {
      console.warn('chth hub: ingest failed', e?.message ?? e);
      return false;
    }
  }
  return {
    enabled,
    /**
     * Sends one event. `user` (a raw user id) is turned into a pseudonym before it leaves.
     * @param {string} type  e.g. start, tip, chat.added, signup, order.created, error, visit
     * @param {Record<string, unknown>} [data]
     * @param {string|number} [user]
     */
    async track(type, data = {}, user) {
      if (!enabled) return false;
      const uid = user == null ? undefined : await pseudonym(cfg.secret, user);
      return post([{ type, at: Math.floor(Date.now() / 1000), uid, data }]);
    },
    /** Sends several prepared events at once (`{ type, data?, user? }`). */
    async batch(list) {
      if (!enabled) return false;
      const events = await Promise.all(list.map(async (e) => ({
        type: e.type, at: Math.floor(Date.now() / 1000), data: e.data ?? {},
        uid: e.user == null ? undefined : await pseudonym(cfg.secret, e.user),
      })));
      return post(events);
    },
  };
}

/** The source tag in a bot /start parameter (`src_gym` → `gym`), or null. */
export function startSource(param) {
  const m = /^src_([a-zA-Z0-9_]{1,40})$/.exec(String(param ?? ''));
  return m ? m[1] : null;
}
