import { corsHeaders, json } from '../_shared/cors.ts';
import { googleAccessToken, googleJson } from '../_shared/google.ts';
import { authenticatedUser, service, userSpaceId } from '../_shared/server.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await authenticatedUser(request);
    const input = await request.json();
    if (!input.title || !input.startsAt) return json({ error: 'Title and date are required' }, 400);
    const spaceId = await userSpaceId(user.id);
    const { accessToken } = await googleAccessToken(user.id);
    const calendarId = input.calendarId ?? 'primary';
    const date = String(input.date ?? input.startsAt).slice(0, 10);
    if (input.allDay && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return json({ error: 'A local calendar date is required for an all-day event' }, 400);
    }
    const googleEvent = await googleJson(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, accessToken, {
      method: 'POST',
      body: JSON.stringify({
        summary: input.title,
        description: input.details,
        start: input.allDay ? { date } : { dateTime: input.startsAt },
        end: input.allDay ? { date: new Date(new Date(`${date}T12:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10) } : { dateTime: input.endsAt ?? input.startsAt },
      }),
    });
    const { data, error } = await service.from('timeline_events').insert({
      space_id: spaceId,
      created_by: user.id,
      title: input.title,
      details: input.details ?? null,
      starts_at: input.allDay ? `${date}T12:00:00.000Z` : input.startsAt,
      ends_at: input.endsAt ?? null,
      all_day: Boolean(input.allDay),
      timezone: 'UTC',
      source: 'google_calendar',
      provider_calendar_id: calendarId,
      provider_event_id: googleEvent.id,
      provider_etag: googleEvent.etag,
      sync_status: 'synced',
    }).select().single();
    if (error) throw error;
    return json({ event: data });
  } catch (error) { return json({ error: error instanceof Error ? error.message : 'Event creation failed' }, 400); }
});
