import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

/**
 * On-device cache for shared media.
 *
 * Goodie/memory previews are served from Supabase behind **signed URLs that
 * expire**, so a remote-only gallery goes blank offline and re-downloads on
 * every refresh. Downloading once into the document directory (which the OS
 * does not reclaim, unlike the cache directory) keeps media viewable with no
 * connection and makes repeat views instant.
 *
 * Keyed by the stable record id rather than the URL, because the signed URL
 * changes on every signing while the underlying file does not.
 *
 * Two scopes, with deliberately different lifetimes:
 *
 * - `shared` — partner Goodies and Memories. Kept indefinitely: this is the
 *   couple's own archive, it is small (previews only), and they expect it
 *   offline.
 * - `friend` — friend-board media. Kept for **two days** from first view, then
 *   dropped and re-fetched on demand. A friend feed is browsed once and rarely
 *   revisited, so holding it forever would grow without bound for no benefit;
 *   two days is long enough that scrolling the board repeatedly, or reopening
 *   the app over a weekend, costs the database nothing.
 */

const FOLDER = 'weship-media';
const FRIEND_FOLDER = 'friends';

export type CacheScope = 'shared' | 'friend';

/** How long friend media survives after it is first downloaded. */
export const FRIEND_MEDIA_TTL_MS = 2 * 24 * 60 * 60 * 1000;

/** Web has no writable file system here; callers fall back to the remote URL. */
const supported = Platform.OS !== 'web';

function cacheDirectory(scope: CacheScope) {
  const base = new Directory(Paths.document, FOLDER);
  const directory = scope === 'friend' ? new Directory(base, FRIEND_FOLDER) : base;
  if (!directory.exists) directory.create({ intermediates: true });
  return directory;
}

function extensionFor(kind: string, remoteUri: string) {
  const fromUri = remoteUri.split('?')[0].split('.').pop()?.toLowerCase();
  if (fromUri && fromUri.length <= 4 && /^[a-z0-9]+$/.test(fromUri)) return fromUri;
  if (kind === 'video') return 'mp4';
  if (kind === 'voice') return 'm4a';
  return 'jpg';
}

/**
 * Whether a cached file is still within its scope's lifetime.
 *
 * Uses the file's own modification time rather than a side index — the
 * filesystem already records when the download landed, and a separate index
 * could drift out of sync with the files it describes.
 */
function isFresh(file: File, scope: CacheScope) {
  if (scope === 'shared') return true;
  const writtenAt = file.lastModified ?? file.modificationTime;
  // No timestamp available (older Android) — treat it as fresh rather than
  // re-downloading on every single view.
  if (!writtenAt) return true;
  return Date.now() - writtenAt < FRIEND_MEDIA_TTL_MS;
}

/** Local file for this record, if it is downloaded and has not expired. */
export function cachedMedia(
  id: string,
  kind: string,
  remoteUri: string,
  scope: CacheScope = 'shared',
): string | undefined {
  if (!supported) return undefined;
  try {
    const file = new File(cacheDirectory(scope), `${id}.${extensionFor(kind, remoteUri)}`);
    if (!file.exists || file.size <= 0) return undefined;
    return isFresh(file, scope) ? file.uri : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Returns a local URI for the record, downloading it once if needed.
 *
 * Falls back to the remote URI when caching is unavailable or fails, so the
 * caller always has something to render.
 */
export async function ensureCachedMedia(
  id: string,
  kind: string,
  remoteUri: string,
  scope: CacheScope = 'shared',
): Promise<string> {
  if (!supported || !remoteUri) return remoteUri;
  try {
    const target = new File(cacheDirectory(scope), `${id}.${extensionFor(kind, remoteUri)}`);
    if (target.exists && target.size > 0) {
      if (isFresh(target, scope)) return target.uri;
      // Expired: drop it first, because `downloadFileAsync` rejects rather than
      // overwriting an existing destination.
      target.delete();
    }
    const downloaded = await File.downloadFileAsync(remoteUri, target);
    return downloaded.uri;
  } catch {
    // Offline, expired URL, or no space — the remote URI is still worth trying.
    return remoteUri;
  }
}

/**
 * Deletes friend media past its lifetime.
 *
 * `cachedMedia` already refuses to serve an expired file, so this is about
 * reclaiming disk rather than correctness. Safe to call often — it only touches
 * the friend folder, never the couple's own archive.
 *
 * @returns how many files were removed.
 */
export function pruneExpiredFriendMedia(): number {
  if (!supported) return 0;
  let removed = 0;
  try {
    for (const entry of cacheDirectory('friend').list()) {
      if (!(entry instanceof File)) continue;
      if (isFresh(entry, 'friend')) continue;
      try {
        entry.delete();
        removed += 1;
      } catch {
        // A file in use or already gone — skip it, try again next sweep.
      }
    }
  } catch {
    // Directory missing or unreadable; nothing to reclaim.
  }
  return removed;
}

/** Bytes currently held, for a future "clear downloads" control. */
export function cachedMediaSize(scope?: CacheScope): number {
  if (!supported) return 0;
  const total = (target: CacheScope) => {
    try {
      return cacheDirectory(target)
        .list()
        .reduce((sum, entry) => sum + (entry instanceof File ? (entry.size ?? 0) : 0), 0);
    } catch {
      return 0;
    }
  };
  if (scope) return total(scope);
  return total('shared') + total('friend');
}
