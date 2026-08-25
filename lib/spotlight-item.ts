import type { PostReactions } from './types';
import type { CacheScope } from './media-cache';
import { dayKeyForInstant, dayKeyIn, relativeDay } from './time';
import type { FriendPost, Goodie } from './types';

/**
 * The shape the Spotlight grid and media viewer render.
 *
 * Partner Goodies and friend-board posts have different storage, different
 * authors, and different privacy — but the same visual language. Both map into
 * this so the masonry and the pop-out viewer are written once.
 *
 * Note that the author is carried inline rather than as an id to resolve: a
 * Goodie's author is always one of the two people in the Space and lives in the
 * store, but a friend's does not.
 */
export type SpotlightItem = {
  id: string;
  kind: 'photo' | 'video' | 'voice' | 'note' | 'reminder';
  text?: string;
  uri?: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
  createdAt: string;
  mine: boolean;
  authorName: string;
  authorPhotoUri?: string;
  authorPhotoSeed?: string;
  /** Author's user id, for opening their profile from a card. Friend items only. */
  authorId?: string;
  /** Reaction tallies for a friend post, so a card can show counts. */
  reactions?: PostReactions;
  /** Which store the bytes came from — only Goodies have a Drive original. */
  source: 'goodie' | 'friend';
  /** The full-resolution original is ready in its owner's Google Drive. */
  originalAvailable?: boolean;
};

/**
 * How long this item's bytes may be kept on device.
 *
 * The couple's own Goodies are theirs to keep; a friend's post is borrowed and
 * expires, so the board stops costing the database without hoarding storage.
 */
export function cacheScopeFor(item: SpotlightItem): CacheScope {
  return item.source === 'friend' ? 'friend' : 'shared';
}

export function goodieToItem(
  goodie: Goodie,
  author: { displayName: string; photoUri?: string; photoSeed?: string },
  mine: boolean,
): SpotlightItem {
  return {
    id: goodie.id,
    kind: goodie.kind,
    text: goodie.text,
    uri: goodie.uri,
    durationSeconds: goodie.durationSeconds,
    width: goodie.width,
    height: goodie.height,
    createdAt: goodie.createdAt,
    mine,
    authorName: author.displayName,
    authorPhotoUri: author.photoUri,
    authorPhotoSeed: author.photoSeed,
    source: 'goodie',
    originalAvailable: goodie.originalAvailable,
  };
}

export function friendPostToItem(post: FriendPost): SpotlightItem {
  return {
    id: post.id,
    kind: post.kind,
    text: post.text,
    uri: post.uri,
    durationSeconds: post.durationSeconds,
    width: post.width,
    height: post.height,
    createdAt: post.createdAt,
    mine: post.mine,
    authorName: post.author.displayName,
    authorPhotoUri: post.author.photoUri,
    authorId: post.author.id,
    reactions: post.reactions,
    // Friend media is stored whole in Supabase, so there is no Drive original
    // to upgrade to — the stored file is already the best copy available.
    source: 'friend',
  };
}

/** One dated heading in a gallery, with the posts that belong under it. */
export type SpotlightDay = { key: string; title: string; items: SpotlightItem[] };

/**
 * How recent a post has to be to sit under "Today" rather than "Earlier today".
 *
 * Both headings describe the same calendar day; this only separates what has
 * just arrived from what has been sitting there since the morning.
 */
const RECENT_HOURS = 6;

/**
 * Groups a gallery into dated sections.
 *
 * Previously everything that was not today fell under a single "Earlier"
 * heading, so yesterday's post and one from three weeks ago read as equally
 * recent. Each calendar day now gets its own heading — "Yesterday", "4 days
 * ago", "Jul 12" — and "Earlier" is reserved for what it sounds like: earlier
 * the same day.
 */
export function groupByDay(
  items: SpotlightItem[],
  timezone: string | undefined,
  now = new Date(),
): SpotlightDay[] {
  const todayKey = dayKeyIn(timezone, now);
  const recentCutoff = now.getTime() - RECENT_HOURS * 3_600_000;
  const days = new Map<string, SpotlightItem[]>();

  for (const item of items) {
    const day = dayKeyForInstant(item.createdAt, timezone);
    // Today alone is split in two, keyed so the fresh half sorts first.
    const key =
      day === todayKey && new Date(item.createdAt).getTime() < recentCutoff ? `${day}#earlier` : day;
    const bucket = days.get(key);
    if (bucket) bucket.push(item);
    else days.set(key, [item]);
  }

  return [...days.entries()]
    // Newest day first, and within today the fresh half above the older half.
    .sort(([a], [b]) => (a.slice(0, 10) === b.slice(0, 10) ? a.length - b.length : a < b ? 1 : -1))
    .map(([key, group]) => ({
      key,
      title:
        key === todayKey
          ? 'Today'
          : key === `${todayKey}#earlier`
            ? 'Earlier today'
            : relativeDay(key, now),
      items: group,
    }));
}
