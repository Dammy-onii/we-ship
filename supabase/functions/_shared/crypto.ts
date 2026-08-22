const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export const TOKEN_KEY_VERSION = Math.max(2, Number(Deno.env.get('PROVIDER_TOKEN_KEY_VERSION') ?? 2));

async function encryptionKey(version: number) {
  const secret = Deno.env.get(`PROVIDER_TOKEN_ENCRYPTION_KEY_V${version}`)
    ?? Deno.env.get('PROVIDER_TOKEN_ENCRYPTION_KEY');
  if (!secret || secret.length < 32) throw new Error('PROVIDER_TOKEN_ENCRYPTION_KEY must contain at least 32 characters');
  if (version === 1) {
    const digest = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
    return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
  }
  const material = await crypto.subtle.importKey('raw', encoder.encode(secret), 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: encoder.encode(`weship-provider-token-v${version}`),
      info: encoder.encode('provider-token-aes-gcm'),
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encrypt(value: string | null | undefined) {
  if (!value) return null;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await encryptionKey(TOKEN_KEY_VERSION), encoder.encode(value)));
  const combined = new Uint8Array(iv.length + ciphertext.length);
  combined.set(iv); combined.set(ciphertext, iv.length);
  return `v${TOKEN_KEY_VERSION}:${toBase64(combined)}`;
}

export async function decrypt(value: string | null | undefined) {
  if (!value) return null;
  const match = /^v(\d+):(.*)$/.exec(value);
  const version = match ? Number(match[1]) : 1;
  const combined = fromBase64(match?.[2] ?? value);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: combined.slice(0, 12) }, await encryptionKey(version), combined.slice(12));
  return decoder.decode(plaintext);
}

export async function sha256Url(value: string) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
  return toBase64(digest).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
