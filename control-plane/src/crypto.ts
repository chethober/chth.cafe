import { base64ToBytes, bytesToBase64 } from '../../src/utils/passwords';

/** Random URL-safe text, for session IDs, OAuth state and setup codes. */
export function randomToken(bytes = 32) {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sha256(text: string) {
  return bytesToBase64(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const keys = new Map<string, Promise<CryptoKey>>();
function key(secret: string) {
  let pending = keys.get(secret);
  if (!pending) {
    const raw = base64ToBytes(secret);
    if (raw.length !== 32) throw new Error('ENCRYPTION_KEY must be 32 bytes, base64-encoded (openssl rand -base64 32).');
    pending = crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
    keys.set(secret, pending);
  }
  return pending;
}

/**
 * Cloudflare credentials are stored encrypted with AES-GCM. The owner ID is bound in as
 * additional data, so a row copied onto another owner does not decrypt.
 */
export async function encrypt(secret: string, ownerId: string, value: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(ownerId) }, await key(secret), new TextEncoder().encode(JSON.stringify(value)));
  return `v1.${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(data))}`;
}

export async function decrypt<T>(secret: string, ownerId: string, sealed: string): Promise<T> {
  const [version, iv, data] = sealed.split('.');
  if (version !== 'v1') throw new Error('Unknown credential format.');
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(iv), additionalData: new TextEncoder().encode(ownerId) }, await key(secret), base64ToBytes(data));
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}
