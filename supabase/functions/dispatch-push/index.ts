import { json } from '../_shared/cors.ts';
import { service } from '../_shared/server.ts';

/**
 * The secret the database trigger is expected to present.
 *
 * Read from `private.app_settings`, which the migration seeds with a random
 * value, so nobody has to copy a secret between two consoles. `PUSH_WEBHOOK_SECRET`
 * still wins when set, for deployments that would rather manage it themselves.
 *
 * Cached for the lifetime of the isolate: this runs on every notification, and
 * a round trip to Postgres just to authenticate one is wasteful.
 */
let cachedSecret: string | null | undefined;

async function expectedSecret(): Promise<string | null> {
  const fromEnv = Deno.env.get('PUSH_WEBHOOK_SECRET');
  if (fromEnv) return fromEnv;
  if (cachedSecret !== undefined) return cachedSecret;
  // Through an RPC rather than a select: `private` is not exposed to PostgREST.
  const { data, error } = await service.rpc('push_dispatch_secret');
  cachedSecret = error ? null : ((data as string | null) ?? null);
  return cachedSecret;
}

Deno.serve(async (request) => {
  try {
    const configuredSecret = await expectedSecret();
    if (!configuredSecret || !(await equalSecret(request.headers.get('x-weship-secret') ?? '', configuredSecret))) return json({ error: 'Unauthorized' }, 401);
    const payload = await request.json();
    const activity = payload.record ?? payload;
    if (!activity?.id) return json({ error: 'Missing notification record' }, 400);

    let ids: string[];
    if (activity.user_id && !activity.space_id) {
      ids = [activity.user_id];
    } else {
      if (!activity.space_id) return json({ error: 'Missing activity recipient' }, 400);
      const { data: members, error: memberError } = await service.from('space_members').select('user_id').eq('space_id', activity.space_id).neq('user_id', activity.actor_id ?? '00000000-0000-0000-0000-000000000000');
      if (memberError) throw memberError;
      ids = (members ?? []).map((member) => member.user_id);
    }
    if (!ids.length) return json({ sent: 0 });
    const { data: tokens, error: tokenError } = await service.from('push_tokens').select('expo_push_token').in('user_id', ids).eq('enabled', true);
    if (tokenError) throw tokenError;

    const messages = (tokens ?? []).map((token) => ({
      to: token.expo_push_token,
      sound: 'default',
      _contentAvailable: true,
      title: activity.title,
      body: activity.body ?? 'Open Weship to see what changed.',
      data: {
        url: activity.route ?? '/notifications',
        activityEventId: activity.id,
        ...(activity.action_data ?? {}),
      },
      categoryId: activity.kind === 'friend_request' ? 'friend_request' : undefined,
      channelId: 'weship-updates-v4',
    }));
    if (!messages.length) return json({ sent: 0 });
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Accept-Encoding': 'gzip, deflate', 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.errors?.[0]?.message ?? 'Expo Push Service rejected the request');
    return json({ sent: messages.length, tickets: result.data });
  } catch (error) { return json({ error: error instanceof Error ? error.message : 'Push dispatch failed' }, 400); }
});

async function equalSecret(received: string, expected: string) {
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(received)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  let difference = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return difference === 0;
}
