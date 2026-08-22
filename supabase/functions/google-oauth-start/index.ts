import { corsHeaders, json } from '../_shared/cors.ts';
import { encrypt, sha256Url } from '../_shared/crypto.ts';
import { authenticatedUser, service } from '../_shared/server.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await authenticatedUser(request);
    const { returnUrl = 'weship://connections/google' } = await request.json().catch(() => ({}));
    if (!String(returnUrl).startsWith('weship://')) return json({ error: 'Invalid return URL' }, 400);
    const state = crypto.randomUUID() + crypto.randomUUID();
    const verifier = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    const stateHash = await sha256Url(state);
    const challenge = await sha256Url(verifier);
    const { error } = await service.rpc('private_store_oauth_session', {
      target_state_hash: stateHash,
      target_user_id: user.id,
      target_provider: 'google',
      verifier_cipher: await encrypt(verifier),
      target_return_url: returnUrl,
    });
    if (error) throw error;

    const scopes = [
      'openid', 'email', 'profile',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/drive.file',
    ];
    const params = new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
      redirect_uri: Deno.env.get('GOOGLE_REDIRECT_URI')!,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      scope: scopes.join(' '),
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });
    return json({ authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Could not start Google OAuth' }, 400);
  }
});

