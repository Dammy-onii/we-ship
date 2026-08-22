import { corsHeaders, json } from '../_shared/cors.ts';
import { googleAccessToken, googleJson } from '../_shared/google.ts';
import { authenticatedUser, service, userSpaceId } from '../_shared/server.ts';

const ROOT_FOLDER_PROPERTY = 'weshipRootFolder';
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'video/mp4',
  'video/quicktime',
]);

type DriveTarget = 'memory' | 'goodie';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const user = await authenticatedUser(request);
    const spaceId = await userSpaceId(user.id);
    const input = await request.json();
    const action = String(input.action ?? '');
    const target = parseTarget(input.target);
    const { accessToken } = await googleAccessToken(user.id);

    if (action === 'delete') {
      const id = parseUuid(input.id, 'id');
      const table = target === 'memory' ? 'memory_media' : 'goodies';
      const fields = target === 'memory'
        ? 'id,space_id,uploaded_by,drive_file_id,drive_owner_id,preview_path,memory_id,upload_status'
        : 'id,space_id,author_id,drive_file_id,drive_owner_id,preview_path,upload_status';
      const rowResult = await service.from(table).select(fields).eq('id', id).single();
      if (rowResult.error || !rowResult.data || rowResult.data.space_id !== spaceId) {
        throw new Error('Media not found');
      }
      const authorId = target === 'memory' ? rowResult.data.uploaded_by : rowResult.data.author_id;
      if (authorId !== user.id || rowResult.data.drive_owner_id !== user.id) {
        throw new Error('Only the uploader can delete this original');
      }
      if (!rowResult.data.drive_file_id) throw new Error('Drive original is unavailable');

      const driveResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(rowResult.data.drive_file_id)}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!driveResponse.ok && driveResponse.status !== 404) {
        throw new Error(await googleError(driveResponse, 'Could not delete the Drive original'));
      }

      const deleteResult = await service.from(table).delete().eq('id', id);
      if (deleteResult.error) throw deleteResult.error;
      if (target === 'memory' && rowResult.data.memory_id) {
        const remaining = await service.from('memory_media')
          .select('id', { count: 'exact', head: true })
          .eq('memory_id', rowResult.data.memory_id);
        if (remaining.error) throw remaining.error;
        if ((remaining.count ?? 0) === 0) {
          const memoryDelete = await service.from('memories').delete().eq('id', rowResult.data.memory_id);
          if (memoryDelete.error) throw memoryDelete.error;
        }
      }
      if (rowResult.data.preview_path) {
        const bucket = target === 'memory' ? 'memory-previews' : 'goodie-previews';
        await service.storage.from(bucket).remove([rowResult.data.preview_path]);
      }
      return json({ deleted: true });
    }

    const uploadId = parseUuid(input.uploadId, 'uploadId');

    if (action === 'start') {
      const mimeType = parseMimeType(input.mimeType);
      // The client still reports sizeBytes for telemetry/limits, but it is no
      // longer declared to Google (see the upload headers below).
      parseSize(input.sizeBytes);
      const folderId = await getOrCreateFolder(accessToken, target);
      const fileName = safeFileName(input.fileName, target, mimeType);
      const response = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size,md5Checksum,trashed,parents,appProperties',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Upload-Content-Type': mimeType,
            // Deliberately not sending X-Upload-Content-Length: it is optional,
            // and declaring a length that disagrees with the uploaded bytes by
            // even one byte makes Drive reject the transfer with a bare 400.
          },
          body: JSON.stringify({
            name: fileName,
            mimeType,
            parents: [folderId],
            appProperties: {
              weshipUploadId: uploadId,
              weshipTarget: target,
              weshipSpaceId: spaceId,
              weshipUploaderId: user.id,
            },
          }),
        },
      );
      if (!response.ok) throw new Error(await googleError(response, 'Could not start Drive upload'));
      const uploadUrl = response.headers.get('Location');
      if (!uploadUrl?.startsWith('https://www.googleapis.com/upload/drive/')) {
        throw new Error('Google did not return a valid resumable upload URL');
      }
      return json({ uploadUrl, uploadId });
    }

    const driveFileId = String(input.driveFileId ?? '').trim();
    if (!driveFileId) throw new Error('driveFileId is required');
    const file = await googleJson(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}?fields=id,name,mimeType,size,md5Checksum,trashed,parents,appProperties`,
      accessToken,
    );
    assertOwnedUpload(file, { uploadId, target, spaceId, userId: user.id });

    if (action === 'discard') {
      const table = target === 'memory' ? 'memory_media' : 'goodies';
      const committed = await service.from(table)
        .select('drive_file_id,upload_status')
        .eq('id', uploadId)
        .maybeSingle();
      if (committed.error) throw committed.error;
      if (committed.data?.drive_file_id === driveFileId && committed.data.upload_status === 'ready') {
        return json({ discarded: false, retained: true });
      }
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok && response.status !== 404) throw new Error(await googleError(response, 'Could not remove incomplete Drive upload'));
      return json({ discarded: true });
    }

    if (action !== 'complete') throw new Error('Unsupported Drive media action');
    const previewPath = `${spaceId}/${user.id}/${uploadId}.jpg`;
    if (input.previewPath !== previewPath) throw new Error('Invalid preview path');
    const sizeBytes = parseSize(file.size, false);

    if (target === 'memory') {
      const title = String(input.title ?? '').trim();
      if (!title) throw new Error('Memory title is required');
      const { data, error } = await service.rpc('finalize_drive_memory_upload', {
        target_media_id: uploadId,
        target_space_id: spaceId,
        target_user_id: user.id,
        target_title: title,
        target_caption: String(input.caption ?? ''),
        target_occurred_on: parseDate(input.date),
        target_media_type: mediaTypeFor(file.mimeType),
        target_preview_path: previewPath,
        target_drive_file_id: file.id,
        target_mime_type: file.mimeType,
        target_size_bytes: sizeBytes,
        target_checksum: file.md5Checksum ?? null,
      });
      if (error) throw error;
      await storeDimensions('memory_media', uploadId, input.width, input.height);
      return json({ status: 'ready', memory: data?.[0] ?? null, driveFileId: file.id });
    }

    const { data, error } = await service.rpc('finalize_drive_goodie_upload', {
      target_goodie_id: uploadId,
      target_space_id: spaceId,
      target_user_id: user.id,
      target_kind: mediaTypeFor(file.mimeType),
      target_body: String(input.text ?? ''),
      target_preview_path: previewPath,
      target_drive_file_id: file.id,
      target_mime_type: file.mimeType,
      target_size_bytes: sizeBytes,
    });
    if (error) throw error;
    await storeDimensions('goodies', uploadId, input.width, input.height);
    return json({ status: 'ready', goodieId: data, driveFileId: file.id });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Drive media request failed' }, 400);
  }
});

async function storeDimensions(table: 'goodies' | 'memory_media', id: string, width: unknown, height: unknown) {
  const parsedWidth = dimension(width);
  const parsedHeight = dimension(height);
  if (!parsedWidth || !parsedHeight) return;
  const { error } = await service.from(table).update({ width: parsedWidth, height: parsedHeight }).eq('id', id);
  if (error) throw error;
}

function dimension(value: unknown) {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 100_000 ? parsed : null;
}

async function getOrCreateFolder(accessToken: string, target: DriveTarget) {
  const rootId = await findFolder(accessToken, ROOT_FOLDER_PROPERTY, 'true')
    ?? await createFolder(accessToken, 'Weship', { [ROOT_FOLDER_PROPERTY]: 'true' });
  const property = `weship${target === 'memory' ? 'Memories' : 'Goodies'}Folder`;
  return await findFolder(accessToken, property, 'true', rootId)
    ?? await createFolder(accessToken, target === 'memory' ? 'Memories' : 'Goodies', { [property]: 'true' }, rootId);
}

async function findFolder(accessToken: string, key: string, value: string, parentId?: string) {
  const clauses = [
    "mimeType = 'application/vnd.google-apps.folder'",
    'trashed = false',
    `appProperties has { key='${key}' and value='${value}' }`,
    ...(parentId ? [`'${parentId}' in parents`] : []),
  ];
  const result = await googleJson(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(clauses.join(' and '))}&spaces=drive&fields=files(id)&pageSize=1`,
    accessToken,
  );
  return result.files?.[0]?.id as string | undefined;
}

async function createFolder(accessToken: string, name: string, appProperties: Record<string, string>, parentId?: string) {
  const result = await googleJson('https://www.googleapis.com/drive/v3/files?fields=id', accessToken, {
    method: 'POST',
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      appProperties,
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  });
  return result.id as string;
}

function assertOwnedUpload(
  file: Record<string, any>,
  expected: { uploadId: string; target: DriveTarget; spaceId: string; userId: string },
) {
  if (file.trashed) throw new Error('The uploaded Drive file is in trash');
  if (!ALLOWED_MIME_TYPES.has(file.mimeType)) throw new Error('The Drive file type is not supported');
  const properties = file.appProperties ?? {};
  if (
    properties.weshipUploadId !== expected.uploadId
    || properties.weshipTarget !== expected.target
    || properties.weshipSpaceId !== expected.spaceId
    || properties.weshipUploaderId !== expected.userId
  ) throw new Error('The Drive upload does not belong to this Weship request');
}

function parseTarget(value: unknown): DriveTarget {
  if (value !== 'memory' && value !== 'goodie') throw new Error('Invalid Drive media target');
  return value;
}

function parseUuid(value: unknown, name: string) {
  const parsed = String(value ?? '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parsed)) {
    throw new Error(`${name} must be a UUID`);
  }
  return parsed;
}

function parseMimeType(value: unknown) {
  const mimeType = String(value ?? '').toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(mimeType)) throw new Error('Choose a supported photo or video');
  return mimeType;
}

function parseSize(value: unknown, allowZero = true) {
  const size = Number(value ?? 0);
  if (!Number.isFinite(size) || size < (allowZero ? 0 : 1) || size > 10 * 1024 * 1024 * 1024) {
    throw new Error('Invalid media size');
  }
  return Math.round(size);
}

function parseDate(value: unknown) {
  const date = String(value ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid memory date');
  return date;
}

function mediaTypeFor(mimeType: string) {
  return mimeType.startsWith('video/') ? 'video' : 'photo';
}

function safeFileName(value: unknown, target: DriveTarget, mimeType: string) {
  const extension = ({
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif',
    'video/mp4': 'mp4', 'video/quicktime': 'mov',
  } as Record<string, string>)[mimeType];
  const fallback = `Weship-${target}-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`;
  const cleaned = String(value ?? '').trim().replace(/[\\/:*?"<>|\u0000-\u001F]/g, '-').slice(0, 180);
  if (!cleaned) return fallback;
  return cleaned.includes('.') ? cleaned : `${cleaned}.${extension}`;
}

async function googleError(response: Response, fallback: string) {
  try {
    const body = await response.json();
    return body.error?.message ?? fallback;
  } catch {
    return fallback;
  }
}
