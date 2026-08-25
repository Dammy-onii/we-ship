import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, InteractionManager } from 'react-native';

import { useAuth } from './auth';
import * as friendsBackend from './backend/friends';
import {
  fetchPersonalNotifications,
  markPersonalNotificationsRead,
  type PersonalNotification,
} from './contacts';
import { pruneExpiredFriendMedia } from './media-cache';
import type { FriendPost, FriendPostKind, FriendRequest, PersonSummary, ReactionKind } from './types';
import { userFacingError } from './user-facing-error';

type FriendsCtx = {
  /** False in demo mode — friends need a real account to exist. */
  enabled: boolean;
  loading: boolean;
  /** True only until the graph has loaded once, so refreshes never blank the page. */
  initialLoading: boolean;
  error?: string;
  friends: PersonSummary[];
  requests: FriendRequest[];
  posts: FriendPost[];
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
  refresh: (options?: { silent?: boolean }) => Promise<void>;
  clearError: () => void;
  search: (query: string) => Promise<PersonSummary[]>;
  addFriend: (targetId: string) => Promise<void>;
  accept: (requestId: string) => Promise<void>;
  decline: (requestId: string) => Promise<void>;
  unfriend: (personId: string) => Promise<void>;
  post: (input: {
    kind: FriendPostKind;
    text?: string;
    uri?: string;
    durationSeconds?: number;
    fileName?: string | null;
    mimeType?: string | null;
    sizeBytes?: number | null;
    width?: number;
    height?: number;
  }) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
  /** Set or clear your reaction to a post; optimistic, reconciled by refresh. */
  react: (postId: string, kind: ReactionKind | null) => Promise<void>;
  /** People from the phone's address book who already have an account. */
  notifications: PersonalNotification[];
  unreadNotifications: number;
  markNotificationsRead: () => Promise<void>;
};

const FriendsContext = createContext<FriendsCtx | null>(null);

/**
 * The friend graph and friend board.
 *
 * Deliberately its own provider rather than part of `StoreProvider`: the store
 * is scoped to a pair Space and unwinds to an empty state when the user has no
 * partner, but friends must work whether or not the user has ever paired.
 */
export function FriendsProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const userId = auth.user?.id;
  const enabled = Boolean(auth.configured && userId);

  const [friends, setFriends] = useState<PersonSummary[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [posts, setPosts] = useState<FriendPost[]>([]);
  const [notifications, setNotifications] = useState<PersonalNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string>();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!enabled || !userId) return;
      if (!options?.silent) setLoading(true);
      try {
        const [graph, board, inbox] = await Promise.all([
          friendsBackend.fetchFriendGraph(userId),
          friendsBackend.fetchFriendPosts(userId),
          fetchPersonalNotifications(),
        ]);
        setFriends(graph.friends);
        setRequests(graph.requests);
        setPosts(board);
        setNotifications(inbox);
        setError(undefined);
        setHydrated(true);
      } catch (cause) {
        setError(userFacingError(cause, 'Friends couldn’t refresh. Please try again.'));
      } finally {
        if (!options?.silent) setLoading(false);
      }
    },
    [enabled, userId],
  );

  useEffect(() => {
    if (enabled) Promise.resolve().then(() => refresh());
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled) return;
    const reconcile = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => refresh({ silent: true }), 250);
    };
    const channel = friendsBackend.subscribeToFriends(reconcile);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') reconcile();
    });
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      channel.unsubscribe();
      appState.remove();
    };
  }, [enabled, refresh]);

  useEffect(() => {
    // Friend media is cached on first view and expires after two days. Sweep
    // once per launch so expired files do not accumulate on disk; the sweep is
    // synchronous but touches only a small folder of already-stale entries.
    const task = InteractionManager.runAfterInteractions(() => pruneExpiredFriendMedia());
    return () => task.cancel();
  }, []);

  const search = useCallback(
    async (query: string) => (enabled ? friendsBackend.searchPeople(query) : []),
    [enabled],
  );

  const mutate = useCallback(
    async (operation: () => Promise<unknown>) => {
      await operation();
      // The graph is small and changes rarely, so a quiet refetch is simpler
      // and safer here than reconciling each edge by hand.
      await refresh({ silent: true });
    },
    [refresh],
  );

  const addFriend = useCallback(
    (targetId: string) => mutate(() => friendsBackend.sendFriendRequest(userId!, targetId)),
    [mutate, userId],
  );
  const accept = useCallback(
    (requestId: string) => mutate(() => friendsBackend.acceptFriendRequest(requestId)),
    [mutate],
  );
  const decline = useCallback(
    (requestId: string) => mutate(() => friendsBackend.removeFriendship(requestId)),
    [mutate],
  );
  const unfriend = useCallback(
    (personId: string) => mutate(() => friendsBackend.removeFriendByUser(userId!, personId)),
    [mutate, userId],
  );
  const post = useCallback<FriendsCtx['post']>(
    (input) => mutate(() => friendsBackend.addFriendPost(userId!, input)),
    [mutate, userId],
  );
  const deletePost = useCallback(
    (postId: string) => mutate(() => friendsBackend.deleteFriendPost(postId)),
    [mutate],
  );

  /**
   * React optimistically, then reconcile.
   *
   * The tap has to feel instant, so the count moves before the server answers.
   * Only this post's tally is touched — the previous reaction is decremented,
   * the new one incremented, and `mine` moved — matching exactly what the RPC
   * does server-side. A failed call falls back to a silent refresh, which
   * restores the true counts.
   */
  const react = useCallback<FriendsCtx['react']>(
    async (postId, kind) => {
      setPosts((current) =>
        current.map((entry) => {
          if (entry.id !== postId) return entry;
          const base = entry.reactions ?? {
            counts: { love: 0, laugh: 0, sad: 0, angry: 0, cry: 0, dislike: 0 },
          };
          const counts = { ...base.counts };
          if (base.mine) counts[base.mine] = Math.max(counts[base.mine] - 1, 0);
          if (kind) counts[kind] += 1;
          return { ...entry, reactions: { counts, mine: kind ?? undefined } };
        }),
      );
      try {
        await friendsBackend.reactToPost(postId, kind);
      } catch {
        await refresh({ silent: true });
      }
    },
    [refresh],
  );

  /*
   * Stable on purpose — no `notifications` dependency.
   *
   * Callers key focus effects off this function, and an identity that changed
   * every time a notification arrived re-ran those effects in a loop. The cost
   * is one UPDATE that matches no rows when there is nothing unread, which is
   * cheaper than the churn was.
   */
  const markNotificationsRead = useCallback(async () => {
    await markPersonalNotificationsRead();
    const now = new Date().toISOString();
    setNotifications((current) =>
      current.some((item) => !item.readAt)
        ? current.map((item) => (item.readAt ? item : { ...item, readAt: now }))
        : current,
    );
  }, []);

  const unreadNotifications = useMemo(
    () => notifications.filter((item) => !item.readAt).length,
    [notifications],
  );

  const clearError = useCallback(() => setError(undefined), []);

  const incoming = useMemo(
    () => requests.filter((request) => request.direction === 'incoming'),
    [requests],
  );
  const outgoing = useMemo(
    () => requests.filter((request) => request.direction === 'outgoing'),
    [requests],
  );

  const value = useMemo<FriendsCtx>(() => ({
    enabled,
    loading,
    initialLoading: loading && !hydrated,
    error,
    friends,
    requests,
    posts,
    incoming,
    outgoing,
    refresh,
    clearError,
    search,
    addFriend,
    accept,
    decline,
    unfriend,
    post,
    deletePost,
    react,
    notifications,
    unreadNotifications,
    markNotificationsRead,
  }), [
    enabled,
    loading,
    hydrated,
    error,
    friends,
    requests,
    posts,
    incoming,
    outgoing,
    refresh,
    clearError,
    search,
    addFriend,
    accept,
    decline,
    unfriend,
    post,
    deletePost,
    react,
    notifications,
    unreadNotifications,
    markNotificationsRead,
  ]);

  return <FriendsContext.Provider value={value}>{children}</FriendsContext.Provider>;
}

export function useFriends(): FriendsCtx {
  const context = useContext(FriendsContext);
  if (!context) throw new Error('useFriends must be used within <FriendsProvider>');
  return context;
}
