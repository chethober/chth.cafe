/**
 * "Connect with Cloudflare": OAuth 2.0 with PKCE against Cloudflare's own authorization server,
 * the one `wrangler login` uses. The client is registered under Manage Account → OAuth apps,
 * and has to be promoted to public before owners outside your account can use it.
 */
import { randomToken, sha256 } from './crypto';

export interface OAuthEnv {
  CF_OAUTH_CLIENT_ID?: string;
  /** Only for confidential clients; public clients rely on PKCE alone. */
  CF_OAUTH_CLIENT_SECRET?: string;
  /** Space-separated; defaults to what deploying a café needs. */
  CF_OAUTH_SCOPES?: string;
  CF_OAUTH_AUTH_URL?: string;
  CF_OAUTH_TOKEN_URL?: string;
  CF_OAUTH_REVOKE_URL?: string;
}

export type Credentials =
  | { kind: 'token'; token: string }
  | { kind: 'oauth'; accessToken: string; refreshToken: string; expiresAt: number; scope: string };

// Cloudflare's scope IDs (GET /client/v4/oauth/scopes), the same permissions as the API token template:
// Workers Scripts, KV and D1 to deploy, Account Settings to list accounts, and Zone Read and Workers Routes
// for custom domains, which the client can mark optional.
const DEFAULT_SCOPES = 'workers-scripts.write workers-kv-storage.write d1.write account-settings.read zone.read workers-routes.write';

export const oauthConfigured = (env: OAuthEnv) => Boolean(env.CF_OAUTH_CLIENT_ID);
const authUrl = (env: OAuthEnv) => env.CF_OAUTH_AUTH_URL || 'https://dash.cloudflare.com/oauth2/auth';
const tokenUrl = (env: OAuthEnv) => env.CF_OAUTH_TOKEN_URL || 'https://dash.cloudflare.com/oauth2/token';
const revokeUrl = (env: OAuthEnv) => env.CF_OAUTH_REVOKE_URL || 'https://dash.cloudflare.com/oauth2/revoke';

export function newVerifier() {
  return randomToken(48);
}

export async function authorizeUrl(env: OAuthEnv, redirectUri: string, state: string, verifier: string) {
  const url = new URL(authUrl(env));
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: env.CF_OAUTH_CLIENT_ID!,
    redirect_uri: redirectUri,
    scope: env.CF_OAUTH_SCOPES || DEFAULT_SCOPES,
    state,
    code_challenge: await sha256(verifier),
    code_challenge_method: 'S256'
  }).toString();
  return url.toString();
}

async function tokenRequest(env: OAuthEnv, params: Record<string, string>): Promise<Credentials & { kind: 'oauth' }> {
  const body = new URLSearchParams({ ...params, client_id: env.CF_OAUTH_CLIENT_ID! });
  if (env.CF_OAUTH_CLIENT_SECRET) body.set('client_secret', env.CF_OAUTH_CLIENT_SECRET);
  const response = await fetch(tokenUrl(env), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body });
  const data = await response.json().catch(() => ({})) as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error?: string; error_description?: string };
  if (!response.ok || !data.access_token) throw new Error(`Cloudflare did not grant access: ${data.error_description || data.error || `HTTP ${response.status}`}.`);
  return {
    kind: 'oauth',
    accessToken: data.access_token,
    // Cloudflare may rotate the refresh token; keep the old one when it does not.
    refreshToken: data.refresh_token || params.refresh_token || '',
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    scope: data.scope || ''
  };
}

export function exchangeCode(env: OAuthEnv, code: string, verifier: string, redirectUri: string) {
  return tokenRequest(env, { grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: redirectUri });
}

export function refresh(env: OAuthEnv, credentials: Credentials & { kind: 'oauth' }) {
  if (!credentials.refreshToken) throw new Error('Cloudflare access expired. Connect your account again.');
  return tokenRequest(env, { grant_type: 'refresh_token', refresh_token: credentials.refreshToken });
}

/** Best effort: the connection is forgotten here even if Cloudflare cannot be reached. */
export async function revoke(env: OAuthEnv, credentials: Credentials) {
  if (credentials.kind !== 'oauth' || !oauthConfigured(env)) return;
  const body = new URLSearchParams({ token: credentials.refreshToken || credentials.accessToken, client_id: env.CF_OAUTH_CLIENT_ID! });
  if (env.CF_OAUTH_CLIENT_SECRET) body.set('client_secret', env.CF_OAUTH_CLIENT_SECRET);
  await fetch(revokeUrl(env), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }).catch(() => {});
}
