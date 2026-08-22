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
import { AppState } from 'react-native';

import { syncTopTodoWidget } from '@/widgets';
import { useAuth } from './auth';
import * as backend from './backend/repository';
import type { MoodKey } from './moods';
import * as seed from './mock/seed';
import { dayKeyIn, deviceTimezone } from './time';
import { loadSnapshot, saveSnapshot } from './offline-cache';
import { userFacingError } from './user-facing-error';
import type {
  Habit,
  Goodie,
  GoodieKind,
  LogDay,
  MemoryItem,
  Moment,
  Note,
  Nudge,
  Presence,
  Question,
  QuestionPrompt,
  Space,
  TaskRoutine,
  User,
} from './types';

const { YOU_ID, PARTNER_ID, CADENCE_DATE } = seed;

type SyncState = {
  mode: 'demo' | 'live';
  loading: boolean;
  /** True only until the space has loaded once. */
  initialLoading: boolean;
  /** ISO time the shown data was cached, when it could not be refreshed. */
  offlineSince?: string;
  paired: boolean;
  error?: string;
  refresh: () => Promise<void>;
  clearError: () => void;
};

type State = {
  space: Space;
  users: Record<string, User>;
  presences: Presence[];
  notes: Note[];
  moments: Moment[];
  today: Question;
  archive: Question[];
  questionQueue: QuestionPrompt[];
  habits: Habit[];
  log: LogDay[];
  nudges: Nudge[];
  memories: MemoryItem[];
  goodies: Goodie[];
};

type Ctx = State & {
  sync: SyncState;
  addNote: (text: string) => void;
  answerToday: (text: string) => void;
  setTodayQuestion: (text: string) => Promise<void>;
  addQuestion: (text: string) => Promise<void>;
  deleteQuestion: (promptId: string) => Promise<void>;
  setMood: (mood: MoodKey, statusText?: string) => void;
  toggleHabit: (habitId: string, note?: string) => void;
  addTask: (input: { label: string; routine: TaskRoutine; noteRequired: boolean }) => void;
  deleteTask: (habitId: string) => void;
  sendNudge: (kind: Nudge['kind']) => void;
  addGoodie: (input: {
    kind: GoodieKind;
    text?: string;
    uri?: string;
    durationSeconds?: number;
    fileName?: string | null;
    mimeType?: string | null;
    sizeBytes?: number | null;
    width?: number;
    height?: number;
    reminderAt?: string;
    onProgress?: (progress: number) => void;
  }) => Promise<void>;
  addMemory: (input: { title: string; subtitle: string; date: string }) => void;
  updateMemory: (id: string, input: { title: string; subtitle: string; date: string }) => void;
};

const StoreContext = createContext<Ctx | null>(null);

function seedLog(): LogDay[] {
  return seed.logHistory.map((day) => {
    if (day.date !== CADENCE_DATE) return day;
    const habits: LogDay['habits'] = {};
    for (const habit of seed.habits) {
      habits[habit.id] = {
        [YOU_ID]: false,
        [PARTNER_ID]: day.habits[habit.id]?.[PARTNER_ID] ?? false,
      };
    }
    return { date: day.date, mood: { [PARTNER_ID]: day.mood[PARTNER_ID] }, habits };
  });
}

function initialState(): State {
  return {
    space: seed.space,
    users: { [YOU_ID]: seed.you, [PARTNER_ID]: seed.partner },
    presences: seed.presences,
    notes: seed.notes,
    moments: seed.moments,
    today: seed.todayQuestion,
    archive: seed.questionArchive,
    questionQueue: [],
    habits: seed.habits,
    log: seedLog(),
    nudges: seed.nudges,
    memories: seed.memories,
    goodies: seed.goodies,
  };
}

function unpairedState(me: User): State {
  const today = todayKey(me.timezone);
  return {
    space: {
      id: 'unpaired',
      memberIds: [YOU_ID, PARTNER_ID],
      mode: 'distance',
      streak: { count: 0, lastActiveDate: today, graceLeft: 1 },
    },
    users: {
      [YOU_ID]: me,
      [PARTNER_ID]: {
        id: PARTNER_ID,
        displayName: 'Your person',
        emoji: '·',
        color: 'them',
        timezone: 'UTC',
        photoSeed: '',
      },
    },
    presences: [
      { userId: YOU_ID, mood: 'calm', updatedAt: new Date().toISOString() },
      { userId: PARTNER_ID, mood: 'calm', updatedAt: new Date().toISOString() },
    ],
    notes: [],
    moments: [],
    today: {
      id: 'waiting-for-space',
      promptDate: today,
      text: 'Create or join a space to receive today’s question.',
      answers: {},
      revealed: false,
    },
    archive: [],
    questionQueue: [],
    habits: [],
    log: [{ date: today, mood: {}, habits: {} }],
    nudges: [],
    memories: [],
    goodies: [],
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [state, setState] = useState<State>(initialState);
  const [rawSpaceId, setRawSpaceId] = useState<string>();
  const [rawUserId, setRawUserId] = useState<string>();
  const [rawPartnerId, setRawPartnerId] = useState<string>();
  const [loading, setLoading] = useState(auth.configured);
  const [paired, setPaired] = useState(!auth.configured);
  const [syncError, setSyncError] = useState<string>();
  const [hydrated, setHydrated] = useState(!auth.configured);
  // Read inside `refresh`, which must not be recreated when hydration flips.
  const hydratedRef = useRef(!auth.configured);
  const [offlineSince, setOfflineSince] = useState<string>();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Re-reads the space.
   *
   * `silent` skips the global loading flag: background reconciliation (Realtime
   * echoes, partner activity) must not blank the screen into a full-page
   * loading state. Only the first hydration should look like loading.
   */
  /** Applies a snapshot from either the network or the on-device cache. */
  const applySnapshot = useCallback((snapshot: backend.LiveSnapshot) => {
    setState((current) => ({ ...current, ...snapshot }));
    setRawSpaceId(snapshot.rawSpaceId);
    setRawUserId(snapshot.rawUserId);
    setRawPartnerId(snapshot.rawPartnerId);
    setPaired(Boolean(snapshot.rawPartnerId));
    setSyncError(undefined);
    setHydrated(true);
    hydratedRef.current = true;
  }, []);

  /**
   * Opens the app from disk before the network is consulted.
   *
   * Waiting for a request to fail can take tens of seconds on a bad
   * connection, which is exactly when someone is staring at a spinner. The
   * cached Space is shown immediately and quietly replaced when the refresh
   * lands.
   */
  useEffect(() => {
    let cancelled = false;
    const userId = auth.user?.id;
    if (!auth.configured || !userId || hydratedRef.current) return;
    loadSnapshot(userId).then((cached) => {
      if (cancelled || !cached || hydratedRef.current) return;
      applySnapshot(cached.snapshot);
      setOfflineSince(cached.savedAt);
    });
    return () => {
      cancelled = true;
    };
  }, [applySnapshot, auth.configured, auth.user?.id]);

  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    const userId = auth.user?.id;
    if (!auth.configured || !userId) return;
    if (!options?.silent) setLoading(true);
    try {
      const snapshot = await backend.fetchLiveSnapshot(userId);
      if (snapshot) {
        applySnapshot(snapshot);
        setOfflineSince(undefined);
        // Kept so the next cold start can open without a connection.
        saveSnapshot(userId, snapshot);
      } else {
        setOfflineSince(undefined);
        const me = await backend.fetchOwnProfile(userId);
        setState(unpairedState(me));
        setRawSpaceId(undefined);
        setRawUserId(userId);
        setRawPartnerId(undefined);
        setPaired(false);
      }
      setSyncError(undefined);
      setHydrated(true);
    } catch (error) {
      // Offline is not a failure state if we have something to show. Fall back
      // to the last known Space and let the app open; only say something went
      // wrong when there is nothing at all behind it.
      const cached = hydratedRef.current ? null : await loadSnapshot(userId);
      if (cached) {
        applySnapshot(cached.snapshot);
        setOfflineSince(cached.savedAt);
      } else {
        setSyncError(userFacingError(error, 'Weship couldn’t refresh. Please try again.'));
      }
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, [applySnapshot, auth.configured, auth.user?.id]);

  const userId = auth.user?.id;
  useEffect(() => {
    if (auth.configured && userId) refresh();
  }, [auth.configured, userId, refresh]);

  useEffect(() => {
    if (!rawSpaceId || !rawUserId) return;
    const channel = backend.subscribeToSpace(rawSpaceId, [rawUserId, rawPartnerId].filter(Boolean) as string[], () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      // Realtime echoes reconcile quietly in the background.
      refreshTimer.current = setTimeout(() => refresh({ silent: true }), 400);
    });
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      channel.unsubscribe();
    };
  }, [rawPartnerId, rawSpaceId, rawUserId, refresh]);

  useEffect(() => {
    if (!auth.configured || !userId) return;
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') refresh({ silent: true });
    });
    return () => subscription.remove();
  }, [auth.configured, refresh, userId]);

  const runRemote = useCallback(
    (operation: () => Promise<unknown>) => {
      // Demo mode is deliberately local-only; nothing to sync.
      if (!auth.configured) return;
      // Signed in but not yet in a Space: there is nowhere to persist this.
      // Say so and reconcile, rather than leaving an optimistic edit that
      // silently disappears on the next refresh.
      if (!rawSpaceId || !rawUserId) {
        setSyncError('Create or join a shared space before making changes.');
        refresh();
        return;
      }
      operation()
        .then(() => {
          // Deliberately no refresh() here. The optimistic update already shows
          // the new value, and Realtime reconciles the rest — refetching every
          // table after each write made the whole space visibly reload and
          // could race the commit, briefly reverting what was just changed.
          setSyncError(undefined);
        })
        .catch((error) => {
          setSyncError(userFacingError(error, 'That change couldn’t be saved. Please try again.'));
          // Only reconcile when the write actually failed, and do it quietly.
          refresh({ silent: true });
        });
    },
    [auth.configured, rawSpaceId, rawUserId, refresh],
  );

  const addNote = useCallback((text: string) => {
    if (!text.trim()) return;
    setState((current) => ({
      ...current,
      notes: [{ id: `n-${Date.now()}`, authorId: YOU_ID, text: text.trim(), createdAt: new Date().toISOString() }, ...current.notes],
    }));
    runRemote(() => backend.addNote(rawSpaceId!, rawUserId!, text));
  }, [rawSpaceId, rawUserId, runRemote]);

  const answerToday = useCallback((text: string) => {
    if (!text.trim()) return;
    setState((current) => {
      const answers = { ...current.today.answers, [YOU_ID]: { text: text.trim(), answeredAt: new Date().toISOString() } };
      return {
        ...current,
        today: { ...current.today, answers, revealed: Object.keys(answers).length >= 2 },
        space: bumpStreak(current.space),
      };
    });
    runRemote(() => backend.answerQuestion(state.today.id, rawSpaceId!, rawUserId!, text));
  }, [rawSpaceId, rawUserId, runRemote, state.today.id]);

  const setTodayQuestion = useCallback(async (text: string) => {
    const prompt = text.trim();
    if (prompt.length < 5) return;
    if (auth.configured) {
      if (!rawSpaceId) throw new Error('Create or join a shared space before setting today’s question.');
      await backend.setDailyQuestion(prompt, state.today.promptDate);
      await refresh();
      return;
    }
    setState((current) => ({ ...current, today: { ...current.today, text: prompt } }));
  }, [auth.configured, rawSpaceId, refresh, state.today.promptDate]);

  const addQuestion = useCallback(async (text: string) => {
    const prompt = text.trim();
    if (!prompt) return;
    if (auth.configured) {
      if (!rawSpaceId || !rawUserId) throw new Error('Create or join a shared space before adding questions.');
      await backend.addCustomQuestion(rawSpaceId, rawUserId, prompt);
      await refresh();
      return;
    }
    setState((current) => ({
      ...current,
      questionQueue: [
        ...current.questionQueue,
        { id: `qp-${Date.now()}`, text: prompt, createdBy: YOU_ID, createdAt: new Date().toISOString() },
      ],
    }));
  }, [auth.configured, rawSpaceId, rawUserId, refresh]);

  const deleteQuestion = useCallback(async (promptId: string) => {
    if (auth.configured) {
      if (!rawSpaceId) throw new Error('Create or join a shared space before changing questions.');
      await backend.deleteCustomQuestion(promptId);
      await refresh();
      return;
    }
    setState((current) => ({
      ...current,
      questionQueue: current.questionQueue.filter((prompt) => prompt.id !== promptId),
    }));
  }, [auth.configured, rawSpaceId, refresh]);

  const setMood = useCallback((mood: MoodKey, statusText?: string) => {
    setState((current) => ({
      ...current,
      presences: current.presences.map((presence) => presence.userId === YOU_ID ? { ...presence, mood, statusText: statusText?.trim() || undefined, updatedAt: new Date().toISOString() } : presence),
      log: current.log.map((day) => day.date === todayKey(myTimezone(current)) ? { ...day, mood: { ...day.mood, [YOU_ID]: mood } } : day),
      space: bumpStreak(current.space, myTimezone(current)),
    }));
    runRemote(() => backend.setPresence(rawSpaceId!, rawUserId!, mood, statusText));
  }, [rawSpaceId, rawUserId, runRemote]);

  const toggleHabit = useCallback((habitId: string, note?: string) => {
    const zone = myTimezone(state);
    const currentLog = state.log.find((day) => day.date === todayKey(zone)) ?? state.log.find((day) => day.date === CADENCE_DATE);
    const completed = !(currentLog?.habits[habitId]?.[YOU_ID] ?? false);
    setState((current) => ({
      ...current,
      log: current.log.map((day) => {
        const isToday = day.date === todayKey(myTimezone(current)) || (!rawSpaceId && day.date === CADENCE_DATE);
        if (!isToday) return day;
        return { ...day, habits: { ...day.habits, [habitId]: { ...day.habits[habitId], [YOU_ID]: completed } } };
      }),
      space: bumpStreak(current.space, myTimezone(current)),
    }));
    runRemote(() => backend.setTaskComplete(habitId, completed, note, zone));
  }, [rawSpaceId, runRemote, state.log, state.users]);

  const addTask = useCallback((input: { label: string; routine: TaskRoutine; noteRequired: boolean }) => {
    const label = input.label.trim();
    if (!label) return;
    setState((current) => ({
      ...current,
      habits: [...current.habits, {
        id: `h-${Date.now()}`,
        label,
        icon: '✓',
        color: ['#5F5B57', '#77736E', '#918C85'][current.habits.length % 3],
        routine: input.routine,
        noteRequired: input.noteRequired,
      }],
    }));
    runRemote(() => backend.addTask(rawSpaceId!, rawUserId!, input));
  }, [rawSpaceId, rawUserId, runRemote]);

  const deleteTask = useCallback((habitId: string) => {
    setState((current) => ({ ...current, habits: current.habits.filter((habit) => habit.id !== habitId) }));
    runRemote(() => backend.deleteTask(habitId));
  }, [runRemote]);

  const sendNudge = useCallback((kind: Nudge['kind']) => {
    setState((current) => ({
      ...current,
      nudges: [{ id: `nu-${Date.now()}`, fromId: YOU_ID, kind, createdAt: new Date().toISOString(), seen: true }, ...current.nudges],
    }));
    runRemote(() => backend.sendNudge(rawSpaceId!, rawUserId!, kind));
  }, [rawSpaceId, rawUserId, runRemote]);

  const addGoodie = useCallback(async (input: {
    kind: GoodieKind;
    text?: string;
    uri?: string;
    durationSeconds?: number;
    fileName?: string | null;
    mimeType?: string | null;
    sizeBytes?: number | null;
    width?: number;
    height?: number;
    reminderAt?: string;
    onProgress?: (progress: number) => void;
  }) => {
    if (auth.configured) {
      if (!rawSpaceId || !rawUserId) throw new Error('Create or join a shared space before sending a Goodie.');
      await backend.addGoodie(rawSpaceId, rawUserId, input);
      await refresh();
      return;
    }
    const goodie = {
      kind: input.kind,
      text: input.text,
      uri: input.uri,
      durationSeconds: input.durationSeconds,
    };
    setState((current) => ({
      ...current,
      goodies: [{ id: `g-${Date.now()}`, authorId: YOU_ID, createdAt: new Date().toISOString(), ...goodie }, ...current.goodies],
    }));
  }, [auth.configured, rawSpaceId, rawUserId, refresh]);

  const addMemory = useCallback((input: { title: string; subtitle: string; date: string }) => {
    setState((current) => ({ ...current, memories: [{ id: `mem-${Date.now()}`, kind: 'milestone', ...input }, ...current.memories] }));
    runRemote(() => backend.addTimelineEvent(rawSpaceId!, rawUserId!, input));
  }, [rawSpaceId, rawUserId, runRemote]);

  const updateMemory = useCallback((id: string, input: { title: string; subtitle: string; date: string }) => {
    setState((current) => ({ ...current, memories: current.memories.map((memory) => memory.id === id ? { ...memory, ...input } : memory) }));
    runRemote(() => backend.updateTimelineEvent(id, input));
  }, [runRemote]);

  const todayLog = state.log.find((day) => day.date === todayKey(myTimezone(state))) ?? state.log.find((day) => day.date === CADENCE_DATE);
  const topTask = state.habits.find((task) => !(todayLog?.habits[task.id]?.[YOU_ID] ?? false));
  useEffect(() => {
    syncTopTodoWidget(topTask ? { label: topTask.label, routine: topTask.routine } : null);
  }, [topTask]);

  const clearSyncError = useCallback(() => setSyncError(undefined), []);

  const sync = useMemo<SyncState>(() => ({
    mode: auth.configured ? 'live' : 'demo',
    loading,
    // Only the very first hydration should be allowed to blank the screen.
    initialLoading: loading && !hydrated,
    offlineSince,
    paired,
    error: syncError,
    refresh,
    clearError: clearSyncError,
  }), [auth.configured, clearSyncError, hydrated, loading, offlineSince, paired, refresh, syncError]);

  const value = useMemo<Ctx>(() => ({
    ...state,
    sync,
    addNote,
    answerToday,
    setTodayQuestion,
    addQuestion,
    deleteQuestion,
    setMood,
    toggleHabit,
    addTask,
    deleteTask,
    sendNudge,
    addGoodie,
    addMemory,
    updateMemory,
  }), [
    state,
    sync,
    addNote,
    answerToday,
    setTodayQuestion,
    addQuestion,
    deleteQuestion,
    setMood,
    toggleHabit,
    addTask,
    deleteTask,
    sendNudge,
    addGoodie,
    addMemory,
    updateMemory,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

/**
 * Today's date key in the signed-in user's timezone.
 *
 * Days must turn over at the user's local midnight — a UTC key would reset the
 * task list at 01:00 in Lagos or 17:00 in US Pacific. Falls back to the device
 * zone when the profile has none.
 */
function todayKey(timezone?: string) {
  return dayKeyIn(timezone ?? deviceTimezone());
}

/** The signed-in user's timezone from a state snapshot. */
function myTimezone(state: State) {
  return state.users[YOU_ID]?.timezone;
}

function bumpStreak(space: Space, timezone?: string): Space {
  const today = todayKey(timezone);
  if (space.streak.lastActiveDate === today) return space;
  const previous = new Date(`${space.streak.lastActiveDate}T12:00:00Z`);
  const current = new Date(`${today}T12:00:00Z`);
  const elapsedDays = Math.round((current.getTime() - previous.getTime()) / 86400000);
  return {
    ...space,
    streak: {
      ...space.streak,
      count: elapsedDays > 0 && elapsedDays <= 2 ? space.streak.count + 1 : 1,
      lastActiveDate: today,
      graceLeft: elapsedDays === 2 ? 0 : 1,
    },
  };
}

function useStore(): Ctx {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used within <StoreProvider>');
  return context;
}

export const useBackendStatus = () => useStore().sync;
export const useSpace = () => useStore().space;
export const useMe = () => useStore().users[YOU_ID];
export const usePartner = () => useStore().users[PARTNER_ID];
export const useUser = (id: string) => useStore().users[id];

export function usePresence(userId: string): Presence {
  return useStore().presences.find((presence) => presence.userId === userId) ?? {
    userId,
    mood: 'calm',
    updatedAt: new Date().toISOString(),
  };
}

export function useNotes() {
  const { notes, addNote } = useStore();
  return { notes, addNote };
}

export const useMoments = () => useStore().moments;

export function useTodayQuestion() {
  const { today, answerToday, setTodayQuestion } = useStore();
  return {
    question: today,
    answer: answerToday,
    setQuestion: setTodayQuestion,
    answered: Boolean(today.answers[YOU_ID]),
    partnerAnswered: Boolean(today.answers[PARTNER_ID]),
    revealed: today.revealed,
  };
}

export const useQuestionArchive = () => useStore().archive;

export function useQuestionQueue() {
  const { questionQueue, addQuestion, deleteQuestion } = useStore();
  return { questions: questionQueue, addQuestion, deleteQuestion };
}

export function useLog() {
  const { log, habits, users, setMood, toggleHabit, addTask, deleteTask } = useStore();
  const key = todayKey(users[YOU_ID]?.timezone);
  const today = log.find((day) => day.date === key) ?? log.find((day) => day.date === CADENCE_DATE) ?? { date: key, mood: {}, habits: {} };
  return { log, habits, today, setMood, toggleHabit, addTask, deleteTask };
}

export const useStreak = () => useStore().space.streak;

export function useNudges() {
  const { nudges, sendNudge } = useStore();
  return { nudges, send: sendNudge };
}

export function useMemories() {
  const { memories, addMemory, updateMemory } = useStore();
  return { memories, addMemory, updateMemory };
}

export function useGoodies() {
  const { goodies, addGoodie } = useStore();
  return { goodies, addGoodie };
}

/**
 * Everything the home-screen widgets need from the Space, in one read.
 *
 * Kept together so the widget snapshot is built from a single consistent view
 * rather than five separate hooks that could tear between renders.
 */
export function useWidgetData() {
  const store = useStore();
  const key = todayKey(store.users[YOU_ID]?.timezone);
  return {
    me: store.users[YOU_ID],
    partner: store.users[PARTNER_ID],
    space: store.space,
    presence: store.presences.find((item) => item.userId === PARTNER_ID),
    question: store.today,
    habits: store.habits,
    todayLog: store.log.find((day) => day.date === key),
    goodies: store.goodies,
    paired: store.sync.paired,
  };
}

export const useOnThisDay = () => useStore().memories.find((memory) => memory.title.includes('year')) ?? null;

export { PARTNER_ID, YOU_ID };
