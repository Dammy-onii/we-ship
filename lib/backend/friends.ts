import type { RealtimeChannel } from '@supabase/supabase-js';
import * as Crypto from 'expo-crypto';

import {
  prepareMediaPreview,
  localMediaMimeType,
  readLocalFileBytes,
  removeTemporaryPreview,
  type LocalMedia,
} from '@/lib/media';
import type { FriendPost, FriendPostKind, FriendRequest, PersonSummary } from '@/lib/types';

import { signedUrl } from './repository';
import { requireSupabase } from './supabase';
import { friendPostCutoffISO } from '../friend-post-ttl';
import type { PostReactions, ReactionKind } from '../types';

type AnyRow = Record<string, any>;

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

async function toPerson(row: AnyRow, status: PersonSummary['status']): Promise<PersonSummary> {
  return {
    id: row.id,
    displayName: row.display_name ?? 'Weship member',
    username: row.username ?? '',
    photoUri: row.avatar_path ? await signedUrl('avatars', row.avatar_path) : undefined,
    status,
  };
}

/**
 * Finds people by handle or name.
 *
 * Goes through the `search_people` RPC rather than selecting `profiles`
 * directly — RLS only exposes people you are already connected to, and search
 * has to reach strangers. The RPC returns a narrow projection for that reason.
 */
export async function searchPeople(query: string): Promise<PersonSummary[]> {
  const term = query.trim();
  if (term.length < 2) return [];
  const { data, error } = await requireSupabase().rpc('search_people', {
    query: term,
    result_limit: 20,
  });
  fail(error);
  const rows = (data ?? []) as AnyRow[];
  return Promise.all(rows.map((row) => toPerson(row, row.friend_status as PersonSummary['status'])));
}

export type FriendGraph = { friends: PersonSummary[]; requests: FriendRequest[] };

export async function fetchFriendGraph(userId: string): Promise<FriendGraph> {
  const client = requireSupabase();
  const graph = await client.rpc('get_friend_graph');
  let rows: AnyRow[];

  if (!graph.error) {
    rows = ((graph.data ?? []) as AnyRow[]).map((row) => ({
      id: row.friendship_id,
      status: row.status,
      created_at: row.created_at,
      requester_id: row.requester_id,
      addressee_id: row.addressee_id,
      other: {
        id: row.other_id,
        display_name: row.other_display_name,
        username: row.other_username,
        avatar_path: row.other_avatar_path,
      },
    }));
  } else {
    // Keep startup compatible with migration 007 while migration 013 (and its
    // PostgREST schema cache) rolls out. Once 013 is present the RPC is used,
    // because its narrow projection can safely show pending-request profiles
    // that the tightened profile RLS deliberately hides from table embeds.
    if (!missingRpc(graph.error, 'get_friend_graph')) fail(graph.error);
    const legacy = await client
      .from('friendships')
      .select(
        'id, status, created_at, requester_id, addressee_id, requester:profiles!friendships_requester_id_fkey(id, display_name, username, avatar_path), addressee:profiles!friendships_addressee_id_fkey(id, display_name, username, avatar_path)',
      )
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
      .order('created_at', { ascending: false });
    fail(legacy.error);
    rows = (legacy.data ?? []) as AnyRow[];
  }

  const friends: PersonSummary[] = [];
  const requests: FriendRequest[] = [];

  for (const row of rows) {
    const iAsked = row.requester_id === userId;
    const related = row.other ?? (iAsked ? row.addressee : row.requester);
    const other = Array.isArray(related) ? related[0] : related;
    if (row.status === 'accepted') {
      friends.push(await toPerson(other, 'friends'));
    } else {
      const direction = iAsked ? 'outgoing' : 'incoming';
      requests.push({
        id: row.id,
        createdAt: row.created_at,
        direction,
        person: await toPerson(other, direction),
      });
    }
  }

  friends.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return { friends, requests };
}

export async function sendFriendRequest(userId: string, targetId: string) {
  const { error } = await requireSupabase()
    .from('friendships')
    .insert({ requester_id: userId, addressee_id: targetId });
  // A crossing request hits `friendships_pair_unique`; say something usable.
  if (error?.code === '23505') throw new Error('You already have a request with this person.');
  fail(error);
}

export async function acceptFriendRequest(requestId: string) {
  const { error } = await requireSupabase().rpc('accept_friend_request', { request_id: requestId });
  fail(error);
}

/** Declines an incoming request, withdraws an outgoing one, or unfriends. */
export async function removeFriendship(requestId: string) {
  const { error } = await requireSupabase().from('friendships').delete().eq('id', requestId);
  fail(error);
}

export async function removeFriendByUser(userId: string, otherId: string) {
  const { error } = await requireSupabase()
    .from('friendships')
    .delete()
    .or(
      `and(requester_id.eq.${userId},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${userId})`,
    );
  fail(error);
}

/**
 * The board: your friends' posts and your own, newest first.
 *
 * Filtered to the post lifetime as well as guarded by RLS. The server is the
 * authority, but the purge runs on a schedule, and asking here means the board
 * and the Spotlight drop a post the moment it expires rather than whenever the
 * next purge happens to land.
 */
export async function fetchFriendPosts(userId: string): Promise<FriendPost[]> {
  const client = requireSupabase();
  const cutoff = friendPostCutoffISO();
  const currentSchema = await client
    .from('friend_posts')
    .select(
      'id, author_id, kind, body, storage_path, duration_seconds, width, height, created_at, author:profiles!friend_posts_author_id_fkey(id, display_name, username, avatar_path)',
    )
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(120);
  let data = currentSchema.data as AnyRow[] | null;
  let error = currentSchema.error;
  // Width/height arrived in migration 013. Older deployments can still show
  // the board correctly (with the legacy crop) while that migration rolls out.
  if (missingColumn(error, ['width', 'height'])) {
    const legacySchema = await client
      .from('friend_posts')
      .select(
        'id, author_id, kind, body, storage_path, duration_seconds, created_at, author:profiles!friend_posts_author_id_fkey(id, display_name, username, avatar_path)',
      )
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(120);
    data = legacySchema.data as AnyRow[] | null;
    error = legacySchema.error;
  }
  fail(error);

  const rows = (data ?? []) as AnyRow[];
  const reactions = await fetchReactionsFor(rows.map((row) => row.id as string), userId);
  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      kind: row.kind as FriendPostKind,
      text: row.body ?? undefined,
      uri: row.storage_path ? await signedUrl('friend-media', row.storage_path) : undefined,
      durationSeconds: row.duration_seconds ?? undefined,
      width: row.width ?? undefined,
      height: row.height ?? undefined,
      createdAt: row.created_at,
      mine: row.author_id === userId,
      author: await toPerson(row.author ?? { id: row.author_id }, 'friends'),
      reactions: reactions.get(row.id) ?? emptyReactions(),
    })),
  );
}

const REACTION_KINDS: ReactionKind[] = ['love', 'laugh', 'sad', 'angry', 'cry', 'dislike'];

function emptyReactions(): PostReactions {
  return { counts: { love: 0, laugh: 0, sad: 0, angry: 0, cry: 0, dislike: 0 } };
}

/**
 * Every reaction on a set of posts, tallied per post.
 *
 * One query for the whole board rather than one per card. Reactions are only
 * readable when the post is (the RLS policy mirrors the post's), so a row coming
 * back is itself proof the caller may count it — no extra check needed here.
 */
async function fetchReactionsFor(
  postIds: string[],
  userId: string,
): Promise<Map<string, PostReactions>> {
  const tally = new Map<string, PostReactions>();
  if (!postIds.length) return tally;
  const { data, error } = await requireSupabase()
    .from('post_reactions')
    .select('post_id, user_id, kind')
    .in('post_id', postIds);
  // A deployment that has not run the reactions migration yet should still show
  // the board, just without counts, rather than failing the whole load.
  if (error) return tally;
  for (const raw of (data ?? []) as AnyRow[]) {
    const entry = tally.get(raw.post_id) ?? emptyReactions();
    const kind = raw.kind as ReactionKind;
    if (REACTION_KINDS.includes(kind)) entry.counts[kind] += 1;
    if (raw.user_id === userId) entry.mine = kind;
    tally.set(raw.post_id, entry);
  }
  return tally;
}

/** Set or change your reaction to a post. Clears it when kind is null. */
export async function reactToPost(postId: string, kind: ReactionKind | null): Promise<void> {
  const client = requireSupabase();
  const { error } =
    kind === null
      ? await client.rpc('clear_post_reaction', { p_post_id: postId })
      : await client.rpc('set_post_reaction', { p_post_id: postId, p_kind: kind });
  fail(error);
}

/** Your own lifetime reaction totals, across every post you have made. */
export async function fetchMyReactionTotals(): Promise<Record<ReactionKind, number>> {
  const totals: Record<ReactionKind, number> = { love: 0, laugh: 0, sad: 0, angry: 0, cry: 0, dislike: 0 };
  const { data, error } = await requireSupabase().rpc('my_reaction_totals');
  if (error) return totals;
  for (const raw of (data ?? []) as AnyRow[]) {
    const kind = raw.kind as ReactionKind;
    if (REACTION_KINDS.includes(kind)) totals[kind] = Number(raw.total) || 0;
  }
  return totals;
}

export async function addFriendPost(
  userId: string,
  input: {
    kind: FriendPostKind;
    text?: string;
    uri?: string;
    durationSeconds?: number;
    fileName?: string | null;
    mimeType?: string | null;
    sizeBytes?: number | null;
    width?: number;
    height?: number;
  },
) {
  const client = requireSupabase();
  let storagePath: string | undefined;
  let mimeType: string | undefined;
  let temporaryPreview: string | undefined;

  try {
    if (input.kind === 'photo' && input.uri) {
      // The board is a view surface, so it carries a compact preview rather
      // than a Drive original — Drive uploads are space-scoped and would not
      // resolve for a friend who is not in your Space.
      const media: LocalMedia = {
        uri: input.uri,
        type: 'photo',
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        width: input.width,
        height: input.height,
      };
      const preview = await prepareMediaPreview(media);
      temporaryPreview = preview.uri;
      mimeType = preview.mimeType;
      storagePath = `${userId}/${Crypto.randomUUID()}.jpg`;
      await upload(storagePath, preview.uri, mimeType);
    } else if (input.kind === 'video' && input.uri) {
      const media: LocalMedia = {
        uri: input.uri,
        type: 'video',
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        width: input.width,
        height: input.height,
      };
      mimeType = localMediaMimeType(media);
      const extension = mimeType === 'video/quicktime' ? 'mov' : 'mp4';
      storagePath = `${userId}/${Crypto.randomUUID()}.${extension}`;
      await upload(storagePath, input.uri, mimeType);
    } else if (input.kind === 'voice' && input.uri) {
      mimeType = input.uri.split('?')[0].endsWith('.aac') ? 'audio/aac' : 'audio/m4a';
      storagePath = `${userId}/${Crypto.randomUUID()}.${mimeType === 'audio/aac' ? 'aac' : 'm4a'}`;
      await upload(storagePath, input.uri, mimeType);
    }

    const record: Record<string, unknown> = {
      author_id: userId,
      kind: input.kind,
      body: input.text?.trim() || null,
      storage_path: storagePath ?? null,
      mime_type: mimeType ?? null,
      duration_seconds: input.durationSeconds ?? null,
      width: input.width ?? null,
      height: input.height ?? null,
    };
    let { error } = await client.from('friend_posts').insert(record);
    if (missingColumn(error, ['width', 'height'])) {
      delete record.width;
      delete record.height;
      ({ error } = await client.from('friend_posts').insert(record));
    }
    if (error) {
      // Do not strand an orphan object in the bucket when the row fails.
      if (storagePath) await client.storage.from('friend-media').remove([storagePath]);
      fail(error);
    }
  } finally {
    removeTemporaryPreview(temporaryPreview);
  }
}

function missingColumn(error: { code?: string; message?: string } | null, columns: string[]) {
  if (!error) return false;
  return error.code === '42703'
    || error.code === 'PGRST204'
    || columns.some((column) => new RegExp(`(?:column|field).*${column}`, 'i').test(error.message ?? ''));
}

function missingRpc(error: { code?: string; message?: string } | null, name: string) {
  return Boolean(
    error
    && (error.code === 'PGRST202'
      || (error.message ?? '').includes(name) && /schema cache|could not find the function/i.test(error.message ?? '')),
  );
}

export async function deleteFriendPost(postId: string) {
  const { error } = await requireSupabase().from('friend_posts').delete().eq('id', postId);
  fail(error);
}

/** RLS limits every event to the signed-in user's own friend graph/inbox. */
export function subscribeToFriends(onChange: () => void): RealtimeChannel {
  let channel = requireSupabase().channel('friends-and-personal-notifications');
  for (const table of ['friendships', 'friend_posts', 'personal_notifications']) {
    channel = channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      onChange,
    );
  }
  return channel.subscribe();
}

export async function setUsername(username: string): Promise<string> {
  const { data, error } = await requireSupabase().rpc('set_username', { new_username: username });
  fail(error);
  return data as string;
}

/** A friend's own page: who they are, and how the two of you are connected. */
export type FriendProfile = PersonSummary & {
  gender?: string;
  /** Their public one-liner, shown on the profile page. */
  bio?: string;
  /** Whether they share a space with a partner. Never who that partner is. */
  paired: boolean;
  friendsSince: string;
};

export async function fetchFriendProfile(personId: string): Promise<FriendProfile | null> {
  const { data, error } = await requireSupabase().rpc('get_friend_profile', { target: personId });
  fail(error);
  const row = ((data ?? []) as AnyRow[])[0];
  if (!row) return null;
  return {
    ...(await toPerson(row, 'friends')),
    gender: row.gender ?? undefined,
    bio: row.bio ?? undefined,
    paired: row.paired === true,
    friendsSince: row.friends_since,
  };
}

async function upload(path: string, uri: string, mimeType: string) {
  const payload = await readLocalFileBytes(uri);
  const { error } = await requireSupabase()
    .storage.from('friend-media')
    .upload(path, payload, { contentType: mimeType, upsert: false });
  if (error) throw new Error(error.message);
}
