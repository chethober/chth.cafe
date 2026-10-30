/** Password hashing shared by the café Worker and the control plane. */

// Cafés usually run on the Workers free plan, whose CPU limit is 10 ms per request; 25,000 rounds take about 6 ms.
// Each hash records its own count, so raising this later keeps existing passwords working. Sign-in is rate limited too.
const ITERATIONS = 25_000;

export const bytesToBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
export const base64ToBytes = (text: string) => new Uint8Array(Array.from(atob(text), char => char.charCodeAt(0)));

async function derive(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256));
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(await derive(password, salt, ITERATIONS))}`;
}

function sameBytes(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, iterations, salt, hash] = stored.split('$');
  if (scheme !== 'pbkdf2' || !salt || !hash) return false;
  return sameBytes(await derive(password, base64ToBytes(salt), Number(iterations)), base64ToBytes(hash));
}

/** Compares secrets in constant time by comparing their digests. */
export async function safeEqual(actual: string, expected: string) {
  const digest = async (value: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  const [a, b] = await Promise.all([digest(actual), digest(expected)]);
  return sameBytes(a, b);
}
