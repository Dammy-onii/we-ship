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
        channelId: 'weship-updates-v3',
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
    return json({ processed: reminders?.length ?? 0, sent });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Reminder dispatch failed' }, 400);
  }
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
