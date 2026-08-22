import { corsHeaders, json } from '../_shared/cors.ts';
import { googleAccessToken, googleJson } from '../_shared/google.ts';
import { authenticatedUser, service } from '../_shared/server.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await authenticatedUser(request);
    const { accessToken, connectionId } = await googleAccessToken(user.id);
    const result = await googleJson('https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader', accessToken);
    const { data: existing } = await service.from('calendar_sources').select('provider_calendar_id,selected').eq('user_id', user.id);
    const selected = new Set((existing ?? []).filter((item) => item.selected).map((item) => item.provider_calendar_id));
    const calendars = (result.items ?? []).map((item: any) => ({
      id: item.id,
      name: item.summaryOverride ?? item.summary,
      color: item.backgroundColor,
      selected: selected.has(item.id),
    }));
    for (const item of result.items ?? []) {
      await service.from('calendar_sources').upsert({
        connection_id: connectionId,
        user_id: user.id,
        provider_calendar_id: item.id,
        name: item.summaryOverride ?? item.summary,
        color: item.backgroundColor,
      }, { onConflict: 'connection_id,provider_calendar_id', ignoreDuplicates: false });
    }
    return json({ calendars });
  } catch (error) { return json({ error: error instanceof Error ? error.message : 'Calendar list failed' }, 400); }
});

