import { corsHeaders, json } from '../_shared/cors.ts';
import { googleAccessToken, googleJson } from '../_shared/google.ts';
import { authenticatedUser, service, userSpaceId } from '../_shared/server.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await authenticatedUser(request);
    const { calendarIds = [], timeMin = new Date().toISOString() } = await request.json();
    if (!Array.isArray(calendarIds) || !calendarIds.length) return json({ error: 'Select at least one calendar' }, 400);
    const spaceId = await userSpaceId(user.id);
    const { accessToken, connectionId } = await googleAccessToken(user.id);
    let imported = 0;
    let updated = 0;
    for (const calendarId of calendarIds.slice(0, 20)) {
      const encoded = encodeURIComponent(calendarId);
      const { data: source } = await service.from('calendar_sources')
        .select('sync_token')
        .eq('connection_id', connectionId)
        .eq('provider_calendar_id', calendarId)
        .maybeSingle();
      const syncToken = source?.sync_token as string | null | undefined;
      let pageToken: string | undefined;
      let nextSyncToken: string | undefined;
      const seen = new Set<string>();
      do {
        const params = new URLSearchParams({ singleEvents: 'true', showDeleted: 'true', maxResults: '2500' });
        if (syncToken) params.set('syncToken', syncToken);
        else {
          params.set('orderBy', 'startTime');
          params.set('timeMin', timeMin);
        }
        if (pageToken) params.set('pageToken', pageToken);
        const result = await googleJson(`https://www.googleapis.com/calendar/v3/calendars/${encoded}/events?${params}`, accessToken);
        for (const event of result.items ?? []) {
          if (!event.id) continue;
          seen.add(event.id);
          if (event.status === 'cancelled') {
            const { error } = await service.from('timeline_events')
              .update({ sync_status: 'deleted', updated_at: new Date().toISOString() })
              .eq('space_id', spaceId)
              .eq('source', 'google_calendar')
              .eq('provider_calendar_id', calendarId)
              .eq('provider_event_id', event.id);
            if (error) throw error;
            continue;
          }
        const startsAt = event.start?.dateTime ?? `${event.start?.date}T12:00:00.000Z`;
        const endsAt = event.end?.dateTime ?? (event.end?.date ? `${event.end.date}T12:00:00.000Z` : null);
        const existing = await service.from('timeline_events').select('id').eq('space_id', spaceId).eq('source', 'google_calendar').eq('provider_event_id', event.id).maybeSingle();
        const { error } = await service.from('timeline_events').upsert({
          space_id: spaceId,
          created_by: user.id,
          title: event.summary ?? 'Untitled event',
          details: event.description ?? null,
          starts_at: startsAt,
          ends_at: endsAt,
          all_day: Boolean(event.start?.date),
          timezone: event.start?.timeZone ?? 'UTC',
          source: 'google_calendar',
          provider_calendar_id: calendarId,
          provider_event_id: event.id,
          provider_etag: event.etag,
          sync_status: 'synced',
        }, { onConflict: 'space_id,source,provider_event_id' });
        if (error) throw error;
        if (existing.data) updated++; else imported++;
        }
        pageToken = result.nextPageToken;
        nextSyncToken = result.nextSyncToken ?? nextSyncToken;
      } while (pageToken);

      // A full window sync can safely tombstone rows Google no longer returns.
      if (!syncToken) {
        const { data: localRows, error: localError } = await service.from('timeline_events')
          .select('id, provider_event_id')
          .eq('space_id', spaceId)
          .eq('source', 'google_calendar')
          .eq('provider_calendar_id', calendarId)
          .gte('starts_at', timeMin);
        if (localError) throw localError;
        const missing = (localRows ?? []).filter((row) => row.provider_event_id && !seen.has(row.provider_event_id)).map((row) => row.id);
        if (missing.length) {
          const { error } = await service.from('timeline_events')
            .update({ sync_status: 'deleted', updated_at: new Date().toISOString() })
            .in('id', missing);
          if (error) throw error;
        }
      }
      const { error: sourceError } = await service.from('calendar_sources').update({
        selected: true,
        share_with_space: true,
        last_synced_at: new Date().toISOString(),
        sync_token: nextSyncToken ?? syncToken ?? null,
      }).eq('connection_id', connectionId).eq('provider_calendar_id', calendarId);
      if (sourceError) throw sourceError;
    }
    return json({ imported, updated });
  } catch (error) { return json({ error: error instanceof Error ? error.message : 'Calendar import failed' }, 400); }
});
