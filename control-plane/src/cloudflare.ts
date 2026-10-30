/**
 * The Cloudflare API calls that create and update a café in the owner's own account.
 * They follow what `wrangler deploy` sends, so a café deployed here matches one deployed by hand.
 */
const API = 'https://api.cloudflare.com/client/v4';

export interface Release {
  name: string;
  version: string;
  commit: string;
  mainModule: string;
  compatibilityDate: string;
  compatibilityFlags: string[];
  runWorkerFirst: boolean;
  crons: string[];
  demoSql: string;
  assets: Record<string, { hash: string; size: number; contentType: string }>;
}

/** Reads one file of the packaged release that ships with the control plane. */
export type ReleaseFiles = (path: string) => Promise<Response>;

export class CloudflareError extends Error {
  constructor(message: string, readonly status: number, readonly codes: number[] = []) { super(message); }
}

interface Envelope<T> { success: boolean; result: T; errors?: { code: number; message: string }[] }

export class CloudflareClient {
  constructor(private token: string) {}

  async call<T>(path: string, init: RequestInit = {}, auth = `Bearer ${this.token}`): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('Authorization', auth);
    if (typeof init.body === 'string') headers.set('Content-Type', 'application/json');
    const response = await fetch(`${API}${path}`, { ...init, headers });
    const body = await response.json().catch(() => null) as Envelope<T> | null;
    if (!response.ok || !body?.success) {
      const errors = body?.errors || [];
      const detail = errors.map(error => `${error.message} (${error.code})`).join('; ') || `HTTP ${response.status}`;
      throw new CloudflareError(`Cloudflare refused ${init.method || 'GET'} ${path.replace(/\?.*$/, '')}: ${detail}`, response.status, errors.map(error => error.code));
    }
    return body.result;
  }

  accounts() {
    return this.call<{ id: string; name: string }[]>('/accounts?per_page=50');
  }
}

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

/** Checks the credentials reach the three things a café needs, naming the missing permission otherwise. */
export async function checkAccess(client: CloudflareClient, accountId: string) {
  const checks: [string, string][] = [
    ['Workers Scripts', `/accounts/${accountId}/workers/scripts`],
    ['D1', `/accounts/${accountId}/d1/database?per_page=1`],
    ['Workers KV Storage', `/accounts/${accountId}/storage/kv/namespaces?per_page=1`]
  ];
  for (const [permission, path] of checks) {
    try { await client.call(path); } catch (error) {
      if (error instanceof CloudflareError && (error.status === 401 || error.status === 403)) throw new CloudflareError(`These credentials cannot use ${permission} on this account. Grant ${permission}: Edit and try again.`, error.status);
      throw error;
    }
  }
}

export interface CafeResources {
  accountId: string;
  scriptName: string;
  databaseId?: string | null;
  kvNamespaceId?: string | null;
  /** Serves the café on example.com, admin.example.com and panel.example.com instead of workers.dev paths. */
  customDomain?: string | null;
}

async function findOrCreateDatabase(client: CloudflareClient, accountId: string, name: string) {
  const existing = await client.call<{ uuid: string; name: string }[]>(`/accounts/${accountId}/d1/database?name=${encodeURIComponent(name)}`);
  const match = existing.find(db => db.name === name);
  if (match) return match.uuid;
  return (await client.call<{ uuid: string }>(`/accounts/${accountId}/d1/database`, json('POST', { name }))).uuid;
}

async function findOrCreateNamespace(client: CloudflareClient, accountId: string, title: string) {
  for (let page = 1; page <= 20; page++) {
    const namespaces = await client.call<{ id: string; title: string }[]>(`/accounts/${accountId}/storage/kv/namespaces?per_page=100&page=${page}`);
    const match = namespaces.find(ns => ns.title === title);
    if (match) return match.id;
    if (namespaces.length < 100) break;
  }
  return (await client.call<{ id: string }>(`/accounts/${accountId}/storage/kv/namespaces`, json('POST', { title }))).id;
}

const jwtPayload = (jwt: string) => {
  try { return JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch { return {}; }
};

function toBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
}

/** Uploads only the files Cloudflare does not already hold, and returns the token that attaches them to the Worker. */
async function uploadAssets(client: CloudflareClient, accountId: string, scriptName: string, release: Release, files: ReleaseFiles) {
  const manifest = Object.fromEntries(Object.entries(release.assets).map(([path, { hash, size }]) => [path, { hash, size }]));
  const session = await client.call<{ jwt: string; buckets: string[][] }>(`/accounts/${accountId}/workers/scripts/${scriptName}/assets-upload-session`, json('POST', { manifest }));
  const byHash = new Map(Object.entries(release.assets).map(([path, asset]) => [asset.hash, { path, ...asset }]));
  const read = async (hash: string) => {
    const asset = byHash.get(hash);
    if (!asset) throw new Error(`Cloudflare asked for an asset that is not in release ${release.version}.`);
    const response = await files(`assets${asset.path}`);
    if (!response.ok) throw new Error(`Release file ${asset.path} is missing.`);
    return { ...asset, body: await response.arrayBuffer() };
  };
  let completion = session.jwt;
  if (jwtPayload(session.jwt).wrangler_single_asset_uploads === true) {
    for (const hash of session.buckets.flat()) {
      const asset = await read(hash);
      const result = await client.call<{ jwt?: string }>(`/accounts/${accountId}/workers/assets/upload/${hash}`, { method: 'POST', headers: { 'Content-Type': asset.contentType }, body: asset.body }, `Bearer ${session.jwt}`);
      completion = result?.jwt || completion;
    }
    return completion;
  }
  for (const bucket of session.buckets) {
    const form = new FormData();
    for (const hash of bucket) {
      const asset = await read(hash);
      form.append(hash, new File([toBase64(asset.body)], hash, { type: asset.contentType }), hash);
    }
    const result = await client.call<{ jwt?: string }>(`/accounts/${accountId}/workers/assets/upload?base64=true`, { method: 'POST', body: form }, `Bearer ${session.jwt}`);
    completion = result?.jwt || completion;
  }
  return completion;
}

async function findZone(client: CloudflareClient, accountId: string, hostname: string) {
  const labels = hostname.split('.');
  for (let i = 0; i < labels.length - 1; i++) {
    const name = labels.slice(i).join('.');
    const zones = await client.call<{ id: string; name: string }[]>(`/zones?name=${encodeURIComponent(name)}&account.id=${accountId}`);
    if (zones[0]) return zones[0].id;
  }
  throw new CloudflareError(`${hostname} is not a zone on this Cloudflare account. Add the domain to Cloudflare first, or leave the custom domain empty.`, 400);
}

export const cafeHosts = (customDomain: string) => [customDomain, `admin.${customDomain}`, `panel.${customDomain}`];

export interface DeployResult {
  databaseId: string;
  kvNamespaceId: string;
  url: string;
  adminUrl: string;
}

/**
 * Creates the café's database and namespace on first deploy, then uploads the release.
 * Running it again with the same resources updates the café in place, keeping its data and secrets.
 */
export async function deployCafe(client: CloudflareClient, cafe: CafeResources, release: Release, files: ReleaseFiles, options: { setupToken?: string; demoData?: boolean; platform?: { url: string; cafeId: string } } = {}): Promise<DeployResult> {
  const { accountId, scriptName } = cafe;
  const base = `/accounts/${accountId}/workers`;
  let subdomain = '';
  try {
    subdomain = (await client.call<{ subdomain: string }>(`${base}/subdomain`)).subdomain;
  } catch (error) {
    if (!cafe.customDomain) throw new CloudflareError('This account has no workers.dev subdomain yet. Open Workers & Pages in the Cloudflare dashboard once to choose one, or use a custom domain.', 400);
  }
  const databaseId = cafe.databaseId || await findOrCreateDatabase(client, accountId, `${scriptName}-db`);
  const kvNamespaceId = cafe.kvNamespaceId || await findOrCreateNamespace(client, accountId, `${scriptName}-kv`);
  if (options.demoData) {
    const sql = await (await files(release.demoSql)).text();
    await client.call(`/accounts/${accountId}/d1/database/${databaseId}/query`, json('POST', { sql }));
  }

  const assetsJwt = await uploadAssets(client, accountId, scriptName, release, files);
  const bindings: Record<string, unknown>[] = [
    { type: 'd1', name: 'DB', id: databaseId },
    { type: 'kv_namespace', name: 'KV', namespace_id: kvNamespaceId },
    { type: 'assets', name: 'ASSETS' }
  ];
  if (!cafe.customDomain) bindings.push({ type: 'plain_text', name: 'CAFE_WORKSPACE_PATHS', text: 'true' });
  // Where the café's admin and panel ask for the platform's notice line.
  if (options.platform) bindings.push({ type: 'plain_text', name: 'PLATFORM_URL', text: options.platform.url }, { type: 'plain_text', name: 'PLATFORM_CAFE_ID', text: options.platform.cafeId });
  if (options.setupToken) bindings.push({ type: 'secret_text', name: 'SETUP_TOKEN', text: options.setupToken });
  const metadata = {
    main_module: release.mainModule,
    compatibility_date: release.compatibilityDate,
    compatibility_flags: release.compatibilityFlags,
    bindings,
    // Secrets set earlier (the setup token, or passwords the owner added) survive updates.
    keep_bindings: ['secret_text', 'secret_key'],
    assets: { jwt: assetsJwt, config: { run_worker_first: release.runWorkerFirst } },
    annotations: { 'workers/message': `CHTH Café ${release.version}` }
  };
  const form = new FormData();
  form.set('metadata', JSON.stringify(metadata));
  const worker = await files(release.mainModule);
  form.set(release.mainModule, new File([await worker.arrayBuffer()], release.mainModule, { type: 'application/javascript+module' }));
  await client.call(`${base}/scripts/${scriptName}`, { method: 'PUT', body: form });

  await client.call(`${base}/scripts/${scriptName}/schedules`, json('PUT', release.crons.map(cron => ({ cron }))));
  if (subdomain) await client.call(`${base}/scripts/${scriptName}/subdomain`, json('POST', { enabled: true, previews_enabled: false }));
  if (cafe.customDomain) {
    const zoneId = await findZone(client, accountId, cafe.customDomain);
    for (const hostname of cafeHosts(cafe.customDomain)) {
      await client.call(`${base}/domains`, json('PUT', { hostname, service: scriptName, zone_id: zoneId, environment: 'production' }));
    }
  }
  const url = cafe.customDomain ? `https://${cafe.customDomain}` : `https://${scriptName}.${subdomain}.workers.dev`;
  return { databaseId, kvNamespaceId, url, adminUrl: cafe.customDomain ? `https://admin.${cafe.customDomain}/` : `${url}/admin` };
}

/** Replaces the one-time setup code, for an owner who lost the first link. */
export function setSetupToken(client: CloudflareClient, cafe: CafeResources, token: string) {
  return client.call(`/accounts/${cafe.accountId}/workers/scripts/${cafe.scriptName}/secrets`, json('PUT', { name: 'SETUP_TOKEN', text: token, type: 'secret_text' }));
}

/** Deletes the Worker, its database and its namespace from the owner's account. The café's data is gone after this. */
export async function deleteCafe(client: CloudflareClient, cafe: CafeResources) {
  const ignoreMissing = (error: unknown) => { if (!(error instanceof CloudflareError && error.status === 404)) throw error; };
  await client.call(`/accounts/${cafe.accountId}/workers/scripts/${cafe.scriptName}?force=true`, { method: 'DELETE' }).catch(ignoreMissing);
  if (cafe.databaseId) await client.call(`/accounts/${cafe.accountId}/d1/database/${cafe.databaseId}`, { method: 'DELETE' }).catch(ignoreMissing);
  if (cafe.kvNamespaceId) await client.call(`/accounts/${cafe.accountId}/storage/kv/namespaces/${cafe.kvNamespaceId}`, { method: 'DELETE' }).catch(ignoreMissing);
}
