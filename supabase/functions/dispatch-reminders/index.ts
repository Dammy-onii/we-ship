import { json } from '../_shared/cors.ts';
import { service } from '../_shared/server.ts';

Deno.serve(async (request) => {
  try {
    const expected = Deno.env.get('PUSH_WEBHOOK_SECRET');
    if (!expected || !(await equalSecret(request.headers.get('x-weship-secret') ?? '', expected))) {
      return json({ error: 'Unauthorized' }, 401);
    }
    const { data: reminders, error } = await service.rpc('claim_due_reminders', { p_limit: 100 });
    if (error) throw error;
    let sent = 0;
    for (const reminder of reminders ?? []) {
      const { data: members, error: memberError } = await service.from('space_members')
        .select('user_id')
        .eq('space_id', reminder.space_id)
        .neq('user_id', reminder.author_id);
      if (memberError) throw memberError;
      const ids = (members ?? []).map((item) => item.user_id);
      const { data: tokens, error: tokenError } = ids.length
        ? await service.from('push_tokens').select('expo_push_token').in('user_id', ids).eq('enabled', true)
        : { data: [], error: null };
      if (tokenError) throw tokenError;
      const messages = (tokens ?? []).map((token) => ({
        to: token.expo_push_token,
        sound: 'default',
        title: 'Reminder from your partner',
        body: reminder.body ?? 'Open Weship to see your reminder.',
        data: { url: '/goodies', goodieId: reminder.reminder_id },
        channelId: 'weship-updates-v4',
        _contentAvailable: true,
      }));
      if (messages.length) {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify(messages),
        });
        if (!response.ok) throw new Error('Expo Push Service rejected a reminder');
        sent += messages.length;
      }
      const { error: markError } = await service.from('goodies')
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq('id', reminder.reminder_id)
        .is('reminder_sent_at', null);
      if (markError) throw markError;
    }
    const purged = await purgeExpiredFriendPosts();
    return json({ processed: reminders?.length ?? 0, sent, purged });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Reminder dispatch failed' }, 400);
  }
});

/** Must match FRIEND_POST_TTL_MS in lib/friend-post-ttl.ts. */
const FRIEND_POST_TTL_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * Deletes friend posts past their lifetime, and the media they own.
 *
 * Rides on the reminder schedule rather than a cron entry of its own: this is
 * already a trusted, service-role, once-a-minute job, and an indexed delete by
 * age costs almost nothing when there is nothing to do.
 *
 * The storage objects go through the Storage API, not a `delete from
 * storage.objects` — the SQL route unlinks the metadata row and leaves the
 * actual file orphaned in the bucket.
 *
 * Failures here are swallowed on purpose. Expired posts are already invisible
 * (the read policy hides them), so a purge that could not run is a housekeeping
 * problem, not a correctness one, and it must never cost a reminder its push.
 */
async function purgeExpiredFriendPosts(): Promise<number> {
  try {
    const cutoff = new Date(Date.now() - FRIEND_POST_TTL_MS).toISOString();
    const { data: expired, error } = await service
      .from('friend_posts')
      .select('id, storage_path')
      .lte('created_at', cutoff)
      // Bounded so one very old backlog cannot stall the minute's reminders.
      // Whatever is left is taken by the next run.
      .limit(500);
    if (error) throw error;
    if (!expired?.length) return 0;

    const paths = expired
      .map((post) => post.storage_path)
      .filter((path): path is string => Boolean(path));
    if (paths.length) {
      const { error: storageError } = await service.storage.from('friend-media').remove(paths);
      if (storageError) throw storageError;
    }

    const { error: deleteError } = await service
      .from('friend_posts')
      .delete()
      .in('id', expired.map((post) => post.id));
    if (deleteError) throw deleteError;
    return expired.length;
  } catch {
    return 0;
  }
}

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
