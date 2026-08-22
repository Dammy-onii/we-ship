import { decrypt, encrypt, sha256Url, TOKEN_KEY_VERSION } from '../_shared/crypto.ts';
import { service } from '../_shared/server.ts';

Deno.serve(async (request) => {
  const requestUrl = new URL(request.url);
  const state = requestUrl.searchParams.get('state');
  const code = requestUrl.searchParams.get('code');
  if (!state || !code) return new Response('Missing OAuth state or code', { status: 400 });

  try {
    const { data, error } = await service.rpc('private_claim_oauth_session', { target_state_hash: await sha256Url(state) });
    if (error || !data?.length) throw new Error('OAuth session expired or was already used');
    const oauth = data[0];
    const verifier = await decrypt(oauth.verifier_cipher);
    if (!verifier) throw new Error('OAuth verifier unavailable');

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
        client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
        redirect_uri: Deno.env.get('GOOGLE_REDIRECT_URI')!,
        grant_type: 'authorization_code',
        code,
        code_verifier: verifier,
      }),
    });
    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok) throw new Error(tokens.error_description ?? 'Google token exchange failed');

    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await profileResponse.json();
    if (!profileResponse.ok) throw new Error('Google account profile could not be read');

    const scopes = String(tokens.scope ?? '').split(' ').filter(Boolean);
    const connectionResult = await service.from('provider_connections').upsert({
      user_id: oauth.user_id,
      provider: 'google',
      provider_account_id: profile.sub,
      account_label: profile.email,
      scopes,
      status: 'active',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' }).select('id').single();
    if (connectionResult.error) throw connectionResult.error;

    const saveResult = await service.rpc('private_store_provider_tokens', {
      target_connection_id: connectionResult.data.id,
      access_cipher: await encrypt(tokens.access_token),
      refresh_cipher: await encrypt(tokens.refresh_token),
      expires_at: new Date(Date.now() + Number(tokens.expires_in ?? 3600) * 1000).toISOString(),
      token_key_version: TOKEN_KEY_VERSION,
    });
    if (saveResult.error) throw saveResult.error;
    const destination = new URL(oauth.return_url);
    destination.searchParams.set('connected', '1');
    return new Response(null, { status: 302, headers: { Location: destination.toString() } });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : 'Google OAuth failed', { status: 400 });
  }
});
