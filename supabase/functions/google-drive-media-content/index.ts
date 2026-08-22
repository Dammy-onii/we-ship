import { corsHeaders, json } from '../_shared/cors.ts';
import { googleAccessToken } from '../_shared/google.ts';
import { authenticatedUser, service, userSpaceId } from '../_shared/server.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'GET' && request.method !== 'HEAD') return json({ error: 'Method not allowed' }, 405);

  try {
    const user = await authenticatedUser(request);
    const spaceId = await userSpaceId(user.id);
    const url = new URL(request.url);
    const target = url.searchParams.get('target');
    const id = url.searchParams.get('id');
    if (!id || (target !== 'memory' && target !== 'goodie')) return json({ error: 'Invalid media request' }, 400);

    const query = target === 'memory'
      ? service.from('memory_media').select('space_id,drive_file_id,drive_owner_id,mime_type,upload_status').eq('id', id).single()
      : service.from('goodies').select('space_id,drive_file_id,drive_owner_id,mime_type,upload_status').eq('id', id).single();
    const { data, error } = await query;
    if (error || !data || data.space_id !== spaceId) return json({ error: 'Media not found' }, 404);
    if (data.upload_status !== 'ready' || !data.drive_file_id || !data.drive_owner_id) return json({ error: 'Original is unavailable' }, 409);

    const { accessToken } = await googleAccessToken(data.drive_owner_id);
    const upstream = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(data.drive_file_id)}?alt=media`,
      {
        method: request.method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(request.headers.get('Range') ? { Range: request.headers.get('Range')! } : {}),
        },
      },
    );
    if (!upstream.ok && upstream.status !== 206) return json({ error: 'Drive original is unavailable' }, upstream.status === 404 ? 404 : 502);

    const headers = new Headers(corsHeaders);
    for (const name of ['Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges', 'ETag', 'Last-Modified']) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    if (!headers.has('Content-Type') && data.mime_type) headers.set('Content-Type', data.mime_type);
    headers.set('Cache-Control', 'private, max-age=300');
    return new Response(request.method === 'HEAD' ? null : upstream.body, { status: upstream.status, headers });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Could not load Drive media' }, 400);
  }
});

