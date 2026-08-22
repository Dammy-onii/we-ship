import type { CacheScope } from './media-cache';
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
    // Friend media is stored whole in Supabase, so there is no Drive original
    // to upgrade to — the stored file is already the best copy available.
    source: 'friend',
  };
}
