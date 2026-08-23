import type { PostgrestError, RealtimeChannel } from '@supabase/supabase-js';
import * as Crypto from 'expo-crypto';

import {
  localMediaMimeType,
  localMediaSize,
  prepareMediaPreview,
  readLocalFileBytes,
  removeTemporaryPreview,
  type LocalMedia,
} from '@/lib/media';
import type { MoodKey } from '@/lib/moods';
import { dayKeyIn, deviceTimezone } from '@/lib/time';
import type {
  Goodie,
  GoodieKind,
  Habit,
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
} from '@/lib/types';

import { isMissingColumn, isMissingRpc, pendingMigrationMessage } from './rpc-compat';
import { COMPLETION_WINDOW_DAYS, type CompletionRow } from '../task-periods';
import { requireSupabase } from './supabase';
import { completeDriveUpload, discardDriveUpload, uploadOriginalToDrive } from './drive';

export const LOCAL_ME_ID = 'you';
export const LOCAL_PARTNER_ID = 'partner';

export type LiveSnapshot = {
  rawSpaceId: string;
  rawUserId: string;
  rawPartnerId?: string;
  space: Space;
  users: Record<string, User>;
  presences: Presence[];
  notes: Note[];
  moments: Moment[];
  today: Question;
  archive: Question[];
  questionQueue: QuestionPrompt[];
  habits: Habit[];
  /** Raw completion rows, which `log` flattens down to the current period only. */
  completions: CompletionRow[];
  log: LogDay[];
  nudges: Nudge[];
  memories: MemoryItem[];
  goodies: Goodie[];
};

type AnyRow = Record<string, any>;

function throwError(error: PostgrestError | null) {
  if (error) throw new Error(error.message);
}

function localUserId(rawId: string, currentUserId: string) {
  return rawId === currentUserId ? LOCAL_ME_ID : LOCAL_PARTNER_ID;
}

/**
 * Today's key in the viewer's timezone. A UTC key would put the day boundary
 * at 01:00 in Lagos or 17:00 in US Pacific, so task periods and "today's
 * question" would flip at the wrong hour.
 */
function currentDate(timezone?: string) {
  return dayKeyIn(timezone ?? deviceTimezone());
}

function emptyQuestion(timezone?: string): Question {
  return {
    id: 'waiting-for-question',
    promptDate: currentDate(timezone),
    text: 'What small thing made you think of us today?',
    answers: {},
    revealed: false,
  };
}

export async function fetchOwnProfile(userId: string): Promise<User> {
  const client = requireSupabase();
  const { data, error } = await client.from('profiles').select('*').eq('id', userId).single();
  throwError(error);
  const row = data as AnyRow;
  return {
    id: LOCAL_ME_ID,
    displayName: row.display_name,
    emoji: '·',
    color: 'you',
    timezone: row.timezone ?? 'UTC',
    photoSeed: '',
    photoUri: row.avatar_path ? await signedUrl('avatars', row.avatar_path) : undefined,
    username: row.username ?? undefined,
    gender: row.gender ?? undefined,
  };
}

/**
 * Oldest `period_key` worth fetching.
 *
 * Filtered on `period_key`, not `completed_at`. The old query asked for the
 * last 45 days of *completion timestamps*, which is both more rows than needed
 * and subtly wrong: a monthly task ticked on the 2nd sits in a period that is
 * still open on the 30th, so a short timestamp window would drop the row and
 * the checkbox would come back unticked. `period_key` is the period's own start
 * date, so bounding on it can never lose a period that is still running — and
 * it is the indexed column in `unique (task_id, user_id, period_key)`.
 *
 * The bound is whichever is earlier: the start of the current month (so the
 * open monthly period is always included) or the tracker's lookback.
 */
function earliestCompletionPeriod(): string {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const lookback = new Date(now.getTime() - COMPLETION_WINDOW_DAYS * 86_400_000);
  const earliest = monthStart < lookback ? monthStart : lookback;
  return earliest.toISOString().slice(0, 10);
}

export async function fetchLiveSnapshot(userId: string): Promise<LiveSnapshot | null> {
  const client = requireSupabase();
  const membershipResult = await client
    .from('space_members')
    .select('space_id')
    .eq('user_id', userId)
    .maybeSingle();
  throwError(membershipResult.error);
  const spaceId = (membershipResult.data as AnyRow | null)?.space_id as string | undefined;
  if (!spaceId) return null;

  const timezoneResult = await client.from('profiles').select('timezone').eq('id', userId).single();
  throwError(timezoneResult.error);
  const today = currentDate((timezoneResult.data as AnyRow).timezone ?? undefined);
  const ensuredQuestion = await client.rpc('ensure_daily_question', { target_day: today });
  throwError(ensuredQuestion.error);

  const [
    spaceResult,
    membersResult,
    tasksResult,
    completionsResult,
    notesResult,
    goodiesResult,
    memoriesResult,
    mediaResult,
    timelineResult,
    presenceResult,
    streakResult,
    nudgesResult,
    questionsResult,
    questionQueueResult,
  ] = await Promise.all([
    client.from('spaces').select('*').eq('id', spaceId).single(),
    client.from('space_members').select('user_id, profiles(*)').eq('space_id', spaceId),
    client.from('tasks').select('*').eq('space_id', spaceId).is('archived_at', null).order('sort_order').order('created_at'),
    client.from('task_completions').select('*').eq('space_id', spaceId).gte('period_key', earliestCompletionPeriod()),
    client.from('notes').select('*').eq('space_id', spaceId).order('created_at', { ascending: false }),
    client.from('goodies').select('*').eq('space_id', spaceId).order('created_at', { ascending: false }).limit(100),
    client.from('memories').select('*').eq('space_id', spaceId).order('occurred_on', { ascending: false }),
    client.from('memory_media').select('*').eq('space_id', spaceId).order('created_at', { ascending: false }),
    client.from('timeline_events').select('*').eq('space_id', spaceId).neq('sync_status', 'deleted').order('starts_at', { ascending: false }),
    client.from('presence').select('*').eq('space_id', spaceId),
    client.from('streaks').select('*').eq('space_id', spaceId).maybeSingle(),
    client.from('nudges').select('*').eq('space_id', spaceId).order('created_at', { ascending: false }).limit(100),
    client.from('questions').select('*, question_answers(*)').eq('space_id', spaceId).order('prompt_date', { ascending: false }).limit(31),
    client.from('custom_question_prompts').select('*').eq('space_id', spaceId).is('used_on', null).order('created_at'),
  ]);

  [
    spaceResult,
    membersResult,
    tasksResult,
    completionsResult,
    notesResult,
    goodiesResult,
    memoriesResult,
    mediaResult,
    timelineResult,
    presenceResult,
    streakResult,
    nudgesResult,
    questionsResult,
    questionQueueResult,
  ].forEach((result) => throwError(result.error));

  const memberRows = (membersResult.data ?? []) as AnyRow[];
  const partnerRow = memberRows.find((row) => row.user_id !== userId);
  const rawPartnerId = partnerRow?.user_id as string | undefined;
  const meRow = memberRows.find((row) => row.user_id === userId)?.profiles as AnyRow | undefined;
  const theirProfile = partnerRow?.profiles as AnyRow | undefined;
  const users: Record<string, User> = {
    [LOCAL_ME_ID]: await mapProfile(meRow, LOCAL_ME_ID, 'you'),
    [LOCAL_PARTNER_ID]: theirProfile
      ? await mapProfile(theirProfile, LOCAL_PARTNER_ID, 'them')
      : {
          id: LOCAL_PARTNER_ID,
          displayName: 'Your person',
          emoji: '·',
          color: 'them',
          timezone: 'UTC',
          photoSeed: '',
        },
  };

  const taskRows = (tasksResult.data ?? []) as AnyRow[];
  const completionRows = (completionsResult.data ?? []) as AnyRow[];
  const habits: Habit[] = taskRows.map((row) => ({
    id: row.id,
    label: row.label,
    icon: '✓',
    color: row.color,
    routine: row.routine,
    noteRequired: row.note_required,
    createdAt: row.created_at,
  }));

  // Day boundaries follow the viewer's own timezone, not UTC.
  const todayLog: LogDay = { date: today, mood: {}, habits: {} };
  for (const task of taskRows) {
    todayLog.habits[task.id] = {};
    for (const completion of completionRows.filter((row) => row.task_id === task.id)) {
      const expectedPeriod = periodKey(task.routine, today);
      if (completion.period_key === expectedPeriod) {
        todayLog.habits[task.id][localUserId(completion.user_id, userId)] = true;
      }
    }
  }

  // Kept alongside `todayLog`, which flattens away everything but the current
  // period — the missed-period tracker needs the history the rows carry.
  const completions: CompletionRow[] = completionRows.map((row) => ({
    taskId: row.task_id,
    userId: localUserId(row.user_id, userId),
    periodKey: row.period_key,
  }));

  const presenceRows = (presenceResult.data ?? []) as AnyRow[];
  const presences: Presence[] = memberRows.map((member) => {
    const row = presenceRows.find((item) => item.user_id === member.user_id);
    return {
      userId: localUserId(member.user_id, userId),
      mood: (row?.mood ?? 'calm') as MoodKey,
      statusText: row?.status_text ?? undefined,
      updatedAt: row?.updated_at ?? new Date().toISOString(),
    };
  });

  const goodieRows = (goodiesResult.data ?? []) as AnyRow[];
  const goodies = await Promise.all(
    goodieRows.map(async (row): Promise<Goodie> => {
      const path = row.preview_path ?? row.storage_path;
      const bucket = row.preview_path ? 'goodie-previews' : 'goodies';
      return {
        id: row.id,
        authorId: localUserId(row.author_id, userId),
        kind: row.kind,
        createdAt: row.created_at,
        text: row.body ?? undefined,
        uri: path ? await signedUrl(bucket, path) : undefined,
        durationSeconds: row.duration_seconds ?? undefined,
        reminderAt: row.reminder_at ?? undefined,
        width: row.width ?? undefined,
        height: row.height ?? undefined,
        originalAvailable: row.storage_provider === 'google_drive' ? row.upload_status === 'ready' : Boolean(row.storage_path),
      };
    }),
  );

  const memoryRows = (memoriesResult.data ?? []) as AnyRow[];
  const mediaRows = (mediaResult.data ?? []) as AnyRow[];
  const moments = await Promise.all(
    mediaRows.map(async (media): Promise<Moment> => {
      const memory = memoryRows.find((row) => row.id === media.memory_id);
      const path = media.preview_path ?? media.storage_path;
      const bucket = media.preview_path ? 'memory-previews' : 'memories';
      return {
        id: media.id,
        authorId: localUserId(media.uploaded_by, userId),
        uri: path ? (await signedUrl(bucket, path)) ?? '' : '',
        seed: '',
        type: media.media_type === 'video' ? 'video' : 'photo',
        caption: memory?.caption ?? memory?.title,
        createdAt: media.created_at,
        originalAvailable: media.storage_provider === 'google_drive' ? media.upload_status === 'ready' : Boolean(media.storage_path),
        width: media.width ?? undefined,
        height: media.height ?? undefined,
      };
    }),
  );

  const timelineMemories: MemoryItem[] = [
    ...memoryRows.map((row) => ({
      id: row.id,
      kind: row.kind,
      title: row.title,
      subtitle: row.caption ?? 'A moment in your shared story',
      date: row.occurred_on,
    })),
    ...((timelineResult.data ?? []) as AnyRow[]).map((row) => ({
      id: row.id,
      kind: 'milestone' as const,
      title: row.title,
      subtitle: row.details ?? (row.source === 'google_calendar' ? 'Imported from Google Calendar' : 'Shared event'),
      date: String(row.starts_at).slice(0, 10),
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const questionRows = (questionsResult.data ?? []) as AnyRow[];
  const questions = questionRows.map((row) => mapQuestion(row, userId));
  const currentQuestion =
    questions.find((question) => question.promptDate === today) ??
    emptyQuestion(users[LOCAL_ME_ID]?.timezone);
  const spaceRow = spaceResult.data as AnyRow;
  const streakRow = streakResult.data as AnyRow | null;

  return {
    rawSpaceId: spaceId,
    rawUserId: userId,
    rawPartnerId,
    space: {
      id: spaceId,
      name: spaceRow.name ?? undefined,
      memberIds: [LOCAL_ME_ID, LOCAL_PARTNER_ID],
      mode: spaceRow.mode,
      anniversary: spaceRow.anniversary ?? undefined,
      streak: {
        count: streakRow?.count ?? 0,
        lastActiveDate: streakRow?.last_active_date ?? today,
        graceLeft: streakRow?.grace_left ?? 1,
      },
    },
    users,
    presences,
    notes: ((notesResult.data ?? []) as AnyRow[]).map((row) => ({
      id: row.id,
      authorId: localUserId(row.author_id, userId),
      text: row.body,
      createdAt: row.created_at,
      pinned: row.pinned,
    })),
    moments,
    today: currentQuestion,
    archive: questions.filter((question) => question.id !== currentQuestion.id),
    questionQueue: ((questionQueueResult.data ?? []) as AnyRow[]).map((row) => ({
      id: row.id,
      text: row.prompt,
      createdBy: localUserId(row.created_by, userId),
      createdAt: row.created_at,
    })),
    habits,
    completions,
    log: [todayLog],
    nudges: ((nudgesResult.data ?? []) as AnyRow[]).map((row) => ({
      id: row.id,
      fromId: localUserId(row.from_user_id, userId),
      kind: row.kind,
      createdAt: row.created_at,
      seen: Boolean(row.seen_at),
    })),
    memories: timelineMemories,
    goodies,
  };
}

async function mapProfile(row: AnyRow | undefined, id: string, color: User['color']): Promise<User> {
  return {
    id,
    displayName: row?.display_name ?? (id === LOCAL_ME_ID ? 'You' : 'Your person'),
    emoji: '·',
    color,
    timezone: row?.timezone ?? 'UTC',
    photoSeed: '',
    photoUri: row?.avatar_path ? await signedUrl('avatars', row.avatar_path) : undefined,
    username: row?.username ?? undefined,
    gender: row?.gender ?? undefined,
  };
}

function mapQuestion(row: AnyRow, currentUserId: string): Question {
  const answers: Question['answers'] = {};
  for (const answer of (row.question_answers ?? []) as AnyRow[]) {
    answers[localUserId(answer.user_id, currentUserId)] = {
      text: answer.answer,
      answeredAt: answer.answered_at,
    };
  }
  return {
    id: row.id,
    promptDate: row.prompt_date,
    text: row.prompt,
    answers,
    revealed: Object.keys(answers).length >= 2,
  };
}

function periodKey(routine: TaskRoutine, date: string) {
  const value = new Date(`${date}T12:00:00Z`);
  if (routine === 'weekly') {
    const day = value.getUTCDay() || 7;
    value.setUTCDate(value.getUTCDate() - day + 1);
  } else if (routine === 'monthly') {
    value.setUTCDate(1);
  }
  return value.toISOString().slice(0, 10);
}

const SIGNED_URL_TTL_SECONDS = 3600;
/** Re-sign this long before expiry so a URL never dies mid-render. */
const SIGNED_URL_REFRESH_MARGIN_MS = 5 * 60 * 1000;

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

/**
 * Signed URL for a storage object, cached until shortly before it expires.
 *
 * Every Realtime change re-runs `fetchLiveSnapshot`, and minting a fresh URL
 * each time changes the string on every refresh — which makes `expo-image`
 * treat the same picture as a new source and refetch it, causing visible
 * flicker whenever the partner does anything. Caching by bucket+path keeps the
 * URL stable between refreshes.
 */
export async function signedUrl(bucket: string, path: string) {
  const now = Date.now();
  for (const [cacheKey, value] of signedUrlCache) {
    if (value.expiresAt <= now) signedUrlCache.delete(cacheKey);
  }
  while (signedUrlCache.size >= 300) {
    const oldest = signedUrlCache.keys().next().value as string | undefined;
    if (!oldest) break;
    signedUrlCache.delete(oldest);
  }
  const key = `${bucket}/${path}`;
  const cached = signedUrlCache.get(key);
  if (cached && cached.expiresAt - SIGNED_URL_REFRESH_MARGIN_MS > Date.now()) return cached.url;

  const { data } = await requireSupabase().storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  const url = data?.signedUrl;
  if (url) {
    signedUrlCache.set(key, { url, expiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000 });
  }
  return url;
}

/** Drop a cached URL when its object is replaced or removed. */
export function invalidateSignedUrl(bucket: string, path: string) {
  signedUrlCache.delete(`${bucket}/${path}`);
}

export function subscribeToSpace(spaceId: string, profileIds: string[], onChange: () => void): RealtimeChannel {
  const client = requireSupabase();
  const tables = [
    'profiles',
    'space_members',
    'tasks',
    'task_completions',
    'goodies',
    'memories',
    'memory_media',
    'timeline_events',
    'notes',
    'presence',
    'streaks',
    'nudges',
    'questions',
    'question_answers',
    'custom_question_prompts',
  ];
  let channel = client.channel(`space:${spaceId}`);
  for (const table of tables) {
    channel = channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table,
        filter: table === 'profiles'
          ? `id=in.(${profileIds.join(',')})`
          : `space_id=eq.${spaceId}`,
      },
      onChange,
    );
  }
  return channel.subscribe();
}

export function subscribeToNotifications(onChange: () => void): RealtimeChannel {
  return requireSupabase()
    .channel('partner-notifications')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, onChange)
    .subscribe();
}

export async function markPartnerNudgesSeen() {
  const client = requireSupabase();
  const { error } = await client.rpc('mark_partner_nudges_seen');
  if (!error) return;
  if (!isMissingRpc(error, 'mark_partner_nudges_seen')) throwError(error);

  // Older schema: mark them directly. `nudges_update_pair` allows a space
  // member to do exactly this, so nothing is lost while the RPC is pending.
  const userId = (await client.auth.getUser()).data.user?.id;
  if (!userId) return;
  const fallback = await client
    .from('nudges')
    .update({ seen: true })
    .neq('from_user_id', userId)
    .eq('seen', false);
  // A schema without `seen` predates this feature entirely — nothing to mark.
  if (fallback.error && !isMissingColumn(fallback.error, ['seen'])) throwError(fallback.error);
}

/**
 * Creates a shared task and returns the id the database assigned it.
 *
 * The caller shows the task immediately under a locally generated placeholder
 * id. That placeholder is not a UUID, so ticking the box before the insert
 * landed sent it straight to Postgres and failed with `invalid input syntax
 * for type uuid`. Returning the real id lets the caller swap it in.
 */
export async function addTask(
  spaceId: string,
  userId: string,
  input: { label: string; routine: TaskRoutine; noteRequired: boolean },
): Promise<string> {
  const { data, error } = await requireSupabase()
    .from('tasks')
    .insert({
      space_id: spaceId,
      created_by: userId,
      label: input.label.trim(),
      routine: input.routine,
      note_required: input.noteRequired,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function deleteTask(taskId: string) {
  const { error } = await requireSupabase().from('tasks').delete().eq('id', taskId);
  throwError(error);
}

export async function setTaskComplete(
  taskId: string,
  completed: boolean,
  note?: string,
  timezone?: string,
) {
  // Parameters are `p_`-prefixed on purpose: a parameter named `task_id`
  // collided with `task_completions.task_id` inside the function body and made
  // every write fail with `42702: column reference "task_id" is ambiguous`.
  const { error } = await requireSupabase().rpc('set_task_complete', {
    p_task_id: taskId,
    p_completed: completed,
    p_note: note ?? null,
    // The server would otherwise key this by its own UTC date, which differs
    // from the day the user is actually looking at.
    p_local_date: currentDate(timezone),
  });
  throwError(error);
}

export async function addNote(spaceId: string, userId: string, body: string) {
  const { error } = await requireSupabase().from('notes').insert({ space_id: spaceId, author_id: userId, body: body.trim() });
  throwError(error);
}

export async function answerQuestion(questionId: string, spaceId: string, userId: string, answer: string) {
  const { error } = await requireSupabase().from('question_answers').upsert(
    { question_id: questionId, space_id: spaceId, user_id: userId, answer: answer.trim(), answered_at: new Date().toISOString() },
    { onConflict: 'question_id,user_id' },
  );
  throwError(error);
}

export async function addCustomQuestion(spaceId: string, userId: string, prompt: string) {
  const { error } = await requireSupabase().from('custom_question_prompts').insert({
    space_id: spaceId,
    created_by: userId,
    prompt: prompt.trim(),
  });
  throwError(error);
}

export async function setDailyQuestion(prompt: string, targetDay: string) {
  const { error } = await requireSupabase().rpc('set_daily_question', {
    question_prompt: prompt.trim(),
    target_day: targetDay,
  });
  throwError(error);
}

export async function deleteCustomQuestion(promptId: string) {
  const { error } = await requireSupabase().from('custom_question_prompts').delete().eq('id', promptId);
  throwError(error);
}

export async function addGoodie(
  spaceId: string,
  userId: string,
  input: {
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
  },
) {
  if ((input.kind === 'photo' || input.kind === 'video') && input.uri) {
    await addDriveMedia(spaceId, userId, {
      uri: input.uri,
      type: input.kind,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      width: input.width,
      height: input.height,
    }, {
      target: 'goodie',
      text: input.text,
      onProgress: input.onProgress,
    });
    return;
  }

  let storagePath: string | undefined;
  let mimeType: string | undefined;
  if (input.uri) {
    mimeType = contentType(input.kind, input.uri);
    storagePath = `${spaceId}/${userId}/${Crypto.randomUUID()}.${extensionFor(mimeType)}`;
    await uploadUri('goodies', storagePath, input.uri, mimeType);
  }
  const { error } = await requireSupabase().from('goodies').insert({
    space_id: spaceId,
    author_id: userId,
    kind: input.kind,
    body: input.text?.trim() || null,
    storage_path: storagePath ?? null,
    mime_type: mimeType ?? null,
    duration_seconds: input.durationSeconds ?? null,
    reminder_at: input.kind === 'reminder' ? input.reminderAt ?? null : null,
  });
  throwError(error);
}

export async function addTimelineEvent(
  spaceId: string,
  userId: string,
  input: { title: string; subtitle: string; date: string },
) {
  const { error } = await requireSupabase().from('timeline_events').insert({
    space_id: spaceId,
    created_by: userId,
    title: input.title.trim(),
    details: input.subtitle.trim() || null,
    starts_at: `${input.date}T12:00:00.000Z`,
    all_day: true,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  throwError(error);
}

export async function updateTimelineEvent(id: string, input: { title: string; subtitle: string; date: string }) {
  const client = requireSupabase();
  const timeline = await client.from('timeline_events').update({
    title: input.title.trim(),
    details: input.subtitle.trim() || null,
    starts_at: `${input.date}T12:00:00.000Z`,
    sync_status: 'pending',
  }).eq('id', id).select('id');
  throwError(timeline.error);
  if (!timeline.data?.length) {
    const memory = await client.from('memories').update({
      title: input.title.trim(),
      caption: input.subtitle.trim() || null,
      occurred_on: input.date,
    }).eq('id', id);
    throwError(memory.error);
  }
}

export async function addMemoryMedia(
  spaceId: string,
  userId: string,
  input: {
    title: string;
    caption?: string;
    date: string;
    uri: string;
    type: 'photo' | 'video';
    fileName?: string | null;
    mimeType?: string | null;
    sizeBytes?: number | null;
    width?: number;
    height?: number;
    onProgress?: (progress: number) => void;
  },
) {
  await addDriveMedia(spaceId, userId, {
    uri: input.uri,
    type: input.type,
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    width: input.width,
    height: input.height,
  }, {
    target: 'memory',
    title: input.title,
    caption: input.caption,
    date: input.date,
    onProgress: input.onProgress,
  });
}

async function addDriveMedia(
  spaceId: string,
  userId: string,
  media: LocalMedia,
  metadata: {
    target: 'memory' | 'goodie';
    title?: string;
    caption?: string;
    date?: string;
    text?: string;
    onProgress?: (progress: number) => void;
  },
) {
  const client = requireSupabase();
  const uploadId = Crypto.randomUUID();
  const preview = await prepareMediaPreview(media);
  const previewBucket = metadata.target === 'memory' ? 'memory-previews' : 'goodie-previews';
  const previewPath = `${spaceId}/${userId}/${uploadId}.jpg`;
  const mimeType = localMediaMimeType(media);
  const original = { ...media, sizeBytes: localMediaSize(media) };
  let driveFileId: string | undefined;

  try {
    await uploadUri(previewBucket, previewPath, preview.uri, preview.mimeType);
    metadata.onProgress?.(0.03);
    const uploaded = await uploadOriginalToDrive({
      target: metadata.target,
      uploadId,
      media: original,
      mimeType,
    }, (progress) => metadata.onProgress?.(0.03 + progress * 0.94));
    driveFileId = uploaded.id;
    await completeDriveUpload({
      target: metadata.target,
      uploadId,
      driveFileId,
      previewPath,
      title: metadata.title,
      caption: metadata.caption,
      date: metadata.date,
      text: metadata.text,
      width: media.width,
      height: media.height,
    });
    metadata.onProgress?.(1);
  } catch (error) {
    const safeToRemovePreview = driveFileId
      ? await discardDriveUpload({ target: metadata.target, uploadId, driveFileId })
      : true;
    if (safeToRemovePreview) {
      await client.storage.from(previewBucket).remove([previewPath]).catch(() => undefined);
    }
    throw error;
  } finally {
    removeTemporaryPreview(preview.uri);
  }
}

async function uploadUri(bucket: string, path: string, uri: string, mimeType: string) {
  const payload = await readLocalFileBytes(uri);
  const { error } = await requireSupabase().storage.from(bucket).upload(path, payload, { contentType: mimeType, upsert: false });
  if (error) throw new Error(error.message);
}

function contentType(kind: GoodieKind | 'photo' | 'video', uri: string) {
  const extension = uri.split('?')[0].split('.').pop()?.toLowerCase();
  if (kind === 'voice') return extension === 'aac' ? 'audio/aac' : 'audio/m4a';
  if (kind === 'video') return extension === 'mov' ? 'video/quicktime' : 'video/mp4';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  return 'image/jpeg';
}

function extensionFor(mimeType: string) {
  return ({
    'audio/aac': 'aac',
    'audio/m4a': 'm4a',
    'video/quicktime': 'mov',
    'video/mp4': 'mp4',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/jpeg': 'jpg',
  } as Record<string, string>)[mimeType] ?? 'bin';
}

export async function createSpace(name: string) {
  const { data, error } = await requireSupabase().rpc('create_pair_space', { space_name: name });
  throwError(error);
  return Array.isArray(data) ? data[0] : data;
}

export async function joinSpace(code: string) {
  const { data, error } = await requireSupabase().rpc('join_pair_space', { invite_code: code });
  throwError(error);
  return data as string;
}

export async function setSpaceAnniversary(date: string) {
  const client = requireSupabase();
  const { error } = await client.rpc('set_space_anniversary', { p_anniversary: date });
  if (!error) return;
  if (!isMissingRpc(error, 'set_space_anniversary')) throwError(error);

  // The RPC is newer than this project's schema. `spaces_update_members` already
  // permits a member to write the column directly, so the feature still works.
  const membership = await client
    .from('space_members')
    .select('space_id')
    .eq('user_id', (await client.auth.getUser()).data.user?.id ?? '')
    .maybeSingle();
  throwError(membership.error);
  const spaceId = (membership.data as AnyRow | null)?.space_id as string | undefined;
  if (!spaceId) throw new Error('Create or join a shared space first.');
  const fallback = await client.from('spaces').update({ anniversary: date }).eq('id', spaceId);
  throwError(fallback.error);
}

/** Renames the shared space. `spaces_update_members` already permits a member to write it. */
export async function renameSpace(name: string) {
  const client = requireSupabase();
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Give your space a name.');
  const membership = await client
    .from('space_members')
    .select('space_id')
    .eq('user_id', (await client.auth.getUser()).data.user?.id ?? '')
    .maybeSingle();
  throwError(membership.error);
  const spaceId = (membership.data as AnyRow | null)?.space_id as string | undefined;
  if (!spaceId) throw new Error('Create or join a shared space first.');
  const { error } = await client.from('spaces').update({ name: trimmed }).eq('id', spaceId);
  throwError(error);
}

/**
 * Puts one of the pair's Goodies at the front of the partner's "Us" widget.
 *
 * The Goodie id goes to the server rather than a Storage path: the client never
 * holds one, and accepting one would let it aim the widget at any object it
 * could guess. Replaces any previous favourite — one live favourite per person.
 */
export async function favouriteGoodieForWidget(goodieId: string) {
  const { error } = await requireSupabase().rpc('favourite_goodie_for_widget', {
    p_goodie_id: goodieId,
  });
  throwError(error);
}

export async function clearWidgetFavourite() {
  const { error } = await requireSupabase().rpc('clear_widget_favourite');
  throwError(error);
}

export type WidgetFavourite = { kind: 'photo' | 'note'; body?: string; uri?: string };

/** The favourite the partner set *for this user*, resolved to a usable image URL. */
export async function fetchWidgetFavourite(userId: string): Promise<WidgetFavourite | null> {
  const { data, error } = await requireSupabase()
    .from('widget_favourites')
    .select('kind, body, preview_path')
    .eq('target_user_id', userId)
    .maybeSingle();
  // A missing table means the migration has not been applied yet; the widget
  // simply has no favourite rather than the whole snapshot failing.
  if (error) return null;
  const row = data as AnyRow | null;
  if (!row) return null;
  return {
    kind: row.kind === 'photo' ? 'photo' : 'note',
    body: row.body ?? undefined,
    uri: row.preview_path ? await signedUrl('goodie-previews', row.preview_path) : undefined,
  };
}

export async function leavePairSpace() {
  const { error } = await requireSupabase().rpc('leave_pair_space');
  if (!error) return;
  // No client-side equivalent: there is deliberately no delete policy on
  // `space_members`, so leaving has to go through the security-definer RPC.
  if (isMissingRpc(error, 'leave_pair_space')) {
    throw new Error(pendingMigrationMessage('Leaving your shared space'));
  }
  throwError(error);
}

export async function deleteOwnAccount() {
  const { error } = await requireSupabase().rpc('delete_own_account');
  if (!error) return;
  // Deleting an auth user is privileged; there is no safe client fallback.
  if (isMissingRpc(error, 'delete_own_account')) {
    throw new Error(pendingMigrationMessage('Deleting your account'));
  }
  throwError(error);
}

export async function updateProfile(
  userId: string,
  input: { displayName: string; timezone: string; gender?: string | null },
) {
  const { error } = await requireSupabase().from('profiles').update({
    display_name: input.displayName.trim(),
    timezone: input.timezone,
    // `undefined` leaves it alone; `null` clears it.
    ...(input.gender !== undefined ? { gender: input.gender } : {}),
  }).eq('id', userId);
  throwError(error);
}

export async function uploadAvatar(userId: string, uri: string) {
  const mimeType = contentType('photo', uri);
  const path = `${userId}/avatar.${extensionFor(mimeType)}`;
  const payload = await readLocalFileBytes(uri);
  const { error: uploadError } = await requireSupabase().storage
    .from('avatars')
    .upload(path, payload, { contentType: mimeType, upsert: true });
  if (uploadError) throw new Error(uploadError.message);
  // The avatar reuses one path, so a stale signed URL would keep showing the
  // previous photo until it expired.
  invalidateSignedUrl('avatars', path);
  const { error } = await requireSupabase().from('profiles').update({ avatar_path: path }).eq('id', userId);
  throwError(error);
}

export async function getActiveInvite(spaceId: string) {
  const { data, error } = await requireSupabase()
    .from('space_invites')
    .select('code, expires_at')
    .eq('space_id', spaceId)
    .is('claimed_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  throwError(error);
  return data as { code: string; expires_at: string } | null;
}

export async function setPresence(
  spaceId: string,
  userId: string,
  mood: MoodKey,
  statusText?: string,
) {
  const { error } = await requireSupabase().from('presence').upsert(
    {
      space_id: spaceId,
      user_id: userId,
      mood,
      // Empty clears it, so a user can drop their custom line again.
      status_text: statusText?.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'space_id,user_id' },
  );
  throwError(error);
}

/**
 * Nudge sent from a widget button.
 *
 * Goes through the RPC rather than a table insert because a widget does not
 * know which Space the user is in — the server resolves that from the caller,
 * which also means a widget can never write into someone else's Space.
 */
export async function sendWidgetNudge(kind: string) {
  const { error } = await requireSupabase().rpc('send_widget_nudge', { p_kind: kind });
  throwError(error);
}

export async function sendNudge(spaceId: string, userId: string, kind: Nudge['kind']) {
  const { error } = await requireSupabase().from('nudges').insert({
    space_id: spaceId,
    from_user_id: userId,
    kind,
  });
  throwError(error);
}

export type PartnerActivity = {
  id: string;
  kind: string;
  title: string;
  body?: string;
  route?: string;
  createdAt: string;
  unread: boolean;
};

export async function fetchPartnerActivities(): Promise<PartnerActivity[]> {
  const { data, error } = await requireSupabase()
    .from('notifications')
    .select('id,read_at,created_at,activity_events(kind,title,body,route,created_at)')
    .order('created_at', { ascending: false })
    .limit(100);
  throwError(error);
  return ((data ?? []) as AnyRow[]).map((row) => ({
    id: row.id,
    kind: row.activity_events?.kind ?? 'activity',
    title: row.activity_events?.title ?? 'Partner activity',
    body: row.activity_events?.body ?? undefined,
    route: row.activity_events?.route ?? undefined,
    createdAt: row.activity_events?.created_at ?? row.created_at,
    unread: !row.read_at,
  }));
}

export async function markPartnerActivitiesRead(ids: string[]) {
  if (!ids.length) return;
  const { error } = await requireSupabase().from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids);
  throwError(error);
}
