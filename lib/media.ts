import { Directory, File, Paths, UploadType, type UploadProgress } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { createVideoPlayer } from 'expo-video';
import { Platform } from 'react-native';

const PREVIEW_MAX_EDGE = 720;
const PREVIEW_MAX_BYTES = 2 * 1024 * 1024;

export type LocalMedia = {
  uri: string;
  type: 'photo' | 'video';
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  width?: number;
  height?: number;
};

export type PreparedPreview = {
  uri: string;
  mimeType: 'image/jpeg';
  sizeBytes: number;
};

export async function prepareMediaPreview(media: LocalMedia): Promise<PreparedPreview> {
  let source: string | Parameters<typeof ImageManipulator.manipulate>[0] = media.uri;

  if (media.type === 'video') {
    if (Platform.OS === 'web') throw new Error('Video uploads require an iOS or Android development build.');
    const player = createVideoPlayer(media.uri);
    try {
      const [thumbnail] = await player.generateThumbnailsAsync(0.1, {
        maxWidth: PREVIEW_MAX_EDGE,
        maxHeight: PREVIEW_MAX_EDGE,
      });
      if (!thumbnail) throw new Error('Could not create a preview from this video.');
      source = thumbnail;
    } finally {
      player.release();
    }
  }

  const context = ImageManipulator.manipulate(source);
  if (media.type === 'photo') {
    const width = media.width ?? PREVIEW_MAX_EDGE;
    const height = media.height ?? PREVIEW_MAX_EDGE;
    if (width > PREVIEW_MAX_EDGE || height > PREVIEW_MAX_EDGE) {
      if (width >= height) context.resize({ width: PREVIEW_MAX_EDGE, height: null });
      else context.resize({ width: null, height: PREVIEW_MAX_EDGE });
    }
  }
  const rendered = await context.renderAsync();
  let saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.62 });
  let previewSize = await uriSize(saved.uri);

  if (previewSize > PREVIEW_MAX_BYTES) {
    const smallerContext = ImageManipulator.manipulate(saved.uri);
    if (saved.width >= saved.height) smallerContext.resize({ width: 480, height: null });
    else smallerContext.resize({ width: null, height: 480 });
    const smaller = await smallerContext.renderAsync();
    saved = await smaller.saveAsync({ format: SaveFormat.JPEG, compress: 0.45 });
    previewSize = await uriSize(saved.uri);
  }
  if (previewSize <= 0 || previewSize > PREVIEW_MAX_BYTES) {
    throw new Error('Weship could not make a small preview for this media.');
  }
  return { uri: saved.uri, mimeType: 'image/jpeg', sizeBytes: previewSize };
}

/**
 * Gives back a path `expo-file-system` can actually open.
 *
 * Android's photo picker hands back `content://` URIs, which `new File(uri)`
 * reports as non-existent — so a perfectly valid selection failed with "the
 * selected file is no longer available on this device". React Native's own
 * networking stack can resolve a content URI, so the bytes are fetched through
 * that and written into the cache, and the copy is uploaded instead.
 */
async function materializeLocalFile(uri: string): Promise<File> {
  const direct = new File(uri);
  if (direct.exists) return direct;

  const response = await fetch(uri);
  if (!response.ok) throw new Error('The selected file could not be read. Please choose it again.');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.byteLength) {
    throw new Error('The selected file could not be read. Please choose it again.');
  }
  const scratch = new Directory(Paths.cache, 'weship-uploads');
  if (!scratch.exists) scratch.create({ intermediates: true });
  // Named for the source so re-picking the same item reuses one cache entry
  // rather than filling the cache with copies.
  const copy = new File(scratch, `${hashUri(uri)}`);
  if (copy.exists) copy.delete();
  copy.create();
  copy.write(bytes);
  return copy;
}

/** Short, stable, filesystem-safe name for a source URI. */
function hashUri(uri: string): string {
  let hash = 2166136261;
  for (let index = 0; index < uri.length; index += 1) {
    hash ^= uri.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `u${(hash >>> 0).toString(36)}`;
}

export async function uploadLocalFile(
  uploadUrl: string,
  media: LocalMedia,
  mimeType: string,
  onProgress?: (progress: number) => void,
) {
  if (Platform.OS === 'web') {
    const local = await fetch(media.uri);
    if (!local.ok) throw new Error('The selected file is no longer available in this browser.');
    const payload = await local.blob();
    onProgress?.(0.1);
    const result = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': mimeType },
      body: payload,
    });
    const body = await result.text();
    if (!result.ok) throw new Error(parseUploadError(body) ?? `Google Drive rejected the upload (${result.status}).`);
    onProgress?.(1);
    return parseUploadResult(body);
  }

  const file = await materializeLocalFile(media.uri);
  const result = await file.upload(uploadUrl, {
    httpMethod: 'PUT',
    uploadType: UploadType.BINARY_CONTENT,
    mimeType,
    headers: { 'Content-Type': mimeType },
    onProgress: (event: UploadProgress) => {
      if (event.totalBytes > 0) onProgress?.(Math.min(1, event.bytesSent / event.totalBytes));
    },
    sessionType: 'background',
  });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(parseUploadError(result.body) ?? `Google Drive rejected the upload (${result.status}).`);
  }
  return parseUploadResult(result.body);
}

export function localMediaMimeType(media: LocalMedia) {
  const supplied = media.mimeType?.toLowerCase();
  if (supplied) return supplied;
  const extension = media.uri.split('?')[0].split('.').pop()?.toLowerCase();
  if (media.type === 'video') return extension === 'mov' ? 'video/quicktime' : 'video/mp4';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'heic') return 'image/heic';
  if (extension === 'heif') return 'image/heif';
  return 'image/jpeg';
}

export function localMediaSize(media: LocalMedia) {
  if (media.sizeBytes && media.sizeBytes > 0) return Math.round(media.sizeBytes);
  if (Platform.OS === 'web') return 0;
  const file = new File(media.uri);
  // A content:// URI reports no size here; the upload path materialises it, and
  // Drive is told the size it actually receives.
  return file.exists ? file.size : 0;
}

/** Read a picker/camera file without treating its local URI like an HTTP URL. */
export async function readLocalFileBytes(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    if (!response.ok) throw new Error('The selected file is no longer available in this browser.');
    return response.arrayBuffer();
  }
  const file = await materializeLocalFile(uri);
  return file.arrayBuffer();
}

export function removeTemporaryPreview(uri: string | undefined) {
  if (!uri || Platform.OS === 'web') return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Cache cleanup is best effort; the OS can evict these files as well.
  }
}

async function uriSize(uri: string) {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    if (!response.ok) return 0;
    return (await response.blob()).size;
  }
  const file = new File(uri);
  return file.exists ? file.size : 0;
}

function parseUploadResult(body: string) {
  try {
    const result = JSON.parse(body) as {
      id: string;
      name?: string;
      mimeType?: string;
      size?: string;
      md5Checksum?: string;
    };
    if (!result.id) throw new Error();
    return result;
  } catch {
    throw new Error('Google Drive completed the upload without returning file details.');
  }
}

function parseUploadError(value: string) {
  try {
    const parsed = JSON.parse(value);
    const message = parsed.error?.message as string | undefined;
    const reason = parsed.error?.errors?.[0]?.reason as string | undefined;
    if (message) return reason ? `${message} (${reason})` : message;
  } catch {
    // Not JSON — fall through and return a trimmed snippet so the real cause
    // is visible instead of only a status code.
  }
  const snippet = value?.trim().slice(0, 180);
  return snippet ? `Google Drive rejected the upload: ${snippet}` : undefined;
}
