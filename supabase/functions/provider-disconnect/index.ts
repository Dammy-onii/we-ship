import { corsHeaders, json } from '../_shared/cors.ts';
import { decrypt } from '../_shared/crypto.ts';
import { authenticatedUser, service } from '../_shared/server.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await authenticatedUser(request);
    const { provider } = await request.json();
    if (!['google', 'spotify'].includes(provider)) return json({ error: 'Unsupported provider' }, 400);
    if (provider === 'google') {
      const { data: rows, error: tokenError } = await service.rpc('private_get_provider_tokens_for_revocation', {
        target_user_id: user.id,
        target_provider: 'google',
      });
      if (tokenError) throw tokenError;
      const row = rows?.[0];
      const token = row ? await decrypt(row.refresh_cipher ?? row.access_cipher) : null;
      if (token) {
        const revoke = await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        if (!revoke.ok) throw new Error('Google did not accept the revocation. Try disconnecting again.');
      }
    }
    const { error } = await service.from('provider_connections').delete().eq('user_id', user.id).eq('provider', provider);
    if (error) throw error;
    return json({ disconnected: true });
  } catch (error) { return json({ error: error instanceof Error ? error.message : 'Disconnect failed' }, 400); }
});
