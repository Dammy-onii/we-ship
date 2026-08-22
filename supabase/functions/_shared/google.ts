import { decrypt, encrypt, TOKEN_KEY_VERSION } from './crypto.ts';
import { service } from './server.ts';

type TokenRow = { connection_id: string; access_cipher: string; refresh_cipher: string; expires_at: string; scopes: string[] };

export async function googleAccessToken(userId: string) {
  const { data, error } = await service.rpc('private_get_provider_tokens', { target_user_id: userId, target_provider: 'google' });
  if (error || !data?.length) throw new Error('Connect Google first');
  const row = data[0] as TokenRow;
  let accessToken = await decrypt(row.access_cipher);
  if (!accessToken) throw new Error('Google connection is invalid');
  if (new Date(row.expires_at).getTime() > Date.now() + 60_000) return { accessToken, connectionId: row.connection_id };

  const refreshToken = await decrypt(row.refresh_cipher);
  if (!refreshToken) throw new Error('Reconnect Google to refresh access');
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const tokens = await response.json();
  if (!response.ok) throw new Error(tokens.error_description ?? 'Google token refresh failed');
  accessToken = tokens.access_token;
  const expiresAt = new Date(Date.now() + Number(tokens.expires_in ?? 3600) * 1000).toISOString();
  const { error: saveError } = await service.rpc('private_store_provider_tokens', {
    target_connection_id: row.connection_id,
    access_cipher: await encrypt(accessToken),
    // Re-encrypt the long-lived token too, so reading a legacy v1 row rotates
    // both fields onto the current version during the normal refresh path.
    refresh_cipher: await encrypt(refreshToken),
    expires_at: expiresAt,
    token_key_version: TOKEN_KEY_VERSION,
  });
  if (saveError) throw saveError;
  return { accessToken, connectionId: row.connection_id };
}

export async function googleJson(url: string, accessToken: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message ?? 'Google request failed');
  return data;
}
