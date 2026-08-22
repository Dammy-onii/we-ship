import { moodOf, type MoodKey } from './moods';
import { ensureCachedMedia } from './media-cache';
import type { Goodie, FriendPost, Habit, LogDay, Presence, Question, Space, User } from './types';

/**
 * Everything the home-screen widgets render, in one payload.
 *
 * Widgets run in a separate process with no network session and no access to
 * the app's React state, so the app pushes a complete snapshot whenever its own
 * data changes. Images are resolved to **local file paths** first: a widget
 * cannot follow an expiring signed URL, and the OS gives it no chance to.
 */

export type CarouselSlide = {
  id: string;
  kind: 'photo' | 'video' | 'note';
  /** Local file path. Absent for notes. */
  imageUri?: string;
  text?: string;
  author: string;
  /** Pinned slides lead the carousel and are marked in the UI. */
  pinned?: boolean;
};

export type WidgetSnapshot = {
  todo: { id: string; label: string; routine: string; noteRequired: boolean } | null;
  presence: {
    name: string;
    mood: string;
    moodEmoji: string;
    statusText?: string;
    /** Their clock, or null when you share a timezone and it would be your own. */
    localTime: string | null;
    /** Shown instead of the clock for same-timezone couples. */
    lastSeen: string;
    avatarUri?: string;
  } | null;
  streak: {
    count: number;
    questionText: string;
    youAnswered: boolean;
    partnerAnswered: boolean;
  } | null;
  partnerSlides: CarouselSlide[];
  friendSlides: CarouselSlide[];
  updatedAt: string;
};

const MAX_SLIDES = 12;

export const EMPTY_SNAPSHOT: WidgetSnapshot = {
  todo: null,
  presence: null,
  streak: null,
  partnerSlides: [],
  friendSlides: [],
  updatedAt: new Date(0).toISOString(),
};

type BuildInput = {
  me: User;
  partner: User;
  space: Space;
  presence: Presence;
  question: Question;
  habits: Habit[];
  todayLog?: LogDay;
  goodies: Goodie[];
  friendPosts: FriendPost[];
  meId: string;
  partnerId: string;
  pin?: { kind: 'photo' | 'note'; body?: string; uri?: string } | null;
};

export async function buildWidgetSnapshot(input: BuildInput): Promise<WidgetSnapshot> {
  const todoTask = input.habits.find(
    (habit) => !(input.todayLog?.habits[habit.id]?.[input.meId] ?? false),
  );

  const sameZone = input.partner.timezone === input.me.timezone;
  const mood = moodOf(input.presence.mood as MoodKey);

  const [partnerSlides, friendSlides] = await Promise.all([
    buildPartnerSlides(input),
    buildFriendSlides(input.friendPosts),
  ]);

  return {
    todo: todoTask
      ? {
          id: todoTask.id,
          label: todoTask.label,
          routine: todoTask.routine,
          noteRequired: todoTask.noteRequired,
        }
      : null,
    presence: {
      name: input.partner.displayName,
      mood: mood.label,
      moodEmoji: mood.emoji,
      statusText: input.presence.statusText,
      localTime: sameZone ? null : clockIn(input.partner.timezone),
      lastSeen: relativeShort(input.presence.updatedAt),
      avatarUri: input.partner.photoUri,
    },
    streak: {
      count: input.space.streak.count,
      questionText: input.question.text,
      youAnswered: Boolean(input.question.answers[input.meId]),
      partnerAnswered: Boolean(input.question.answers[input.partnerId]),
    },
    partnerSlides,
    friendSlides,
    updatedAt: new Date().toISOString(),
  };
}

async function buildPartnerSlides(input: BuildInput): Promise<CarouselSlide[]> {
  const slides: CarouselSlide[] = [];

  // A partner's pin always leads, so pushing something to their home screen
  // actually shows up first rather than competing with the newest Goodie.
  if (input.pin) {
    slides.push({
      id: 'pin',
      kind: input.pin.kind === 'photo' ? 'photo' : 'note',
      text: input.pin.body,
      imageUri: input.pin.uri
        ? await localCopy('pin', input.pin.kind, input.pin.uri)
        : undefined,
      author: input.partner.displayName,
      pinned: true,
    });
  }

  for (const goodie of input.goodies) {
    if (slides.length >= MAX_SLIDES) break;
    if (goodie.kind !== 'photo' && goodie.kind !== 'video' && goodie.kind !== 'note') continue;
    const author = goodie.authorId === input.meId ? input.me : input.partner;
    slides.push({
      id: goodie.id,
      kind: goodie.kind,
      text: goodie.text,
      imageUri: goodie.uri ? await localCopy(goodie.id, goodie.kind, goodie.uri) : undefined,
      author: author.displayName,
    });
  }

  return slides;
}

async function buildFriendSlides(posts: FriendPost[]): Promise<CarouselSlide[]> {
  const slides: CarouselSlide[] = [];
  for (const post of posts) {
    if (slides.length >= MAX_SLIDES) break;
    if (post.kind !== 'photo' && post.kind !== 'video' && post.kind !== 'note') continue;
    slides.push({
      id: post.id,
      kind: post.kind,
      text: post.text,
      imageUri: post.uri ? await localCopy(post.id, post.kind, post.uri, 'friend') : undefined,
      author: post.author.displayName,
    });
  }
  return slides;
}

/**
 * A widget cannot follow an expiring signed URL, so every image must already be
 * a file on disk. Failures resolve to `undefined` rather than throwing — one
 * unreachable image should not cost the whole snapshot.
 */
async function localCopy(
  id: string,
  kind: string,
  remoteUri: string,
  scope: 'shared' | 'friend' = 'shared',
): Promise<string | undefined> {
  try {
    const uri = await ensureCachedMedia(id, kind, remoteUri, scope);
    return uri.startsWith('file://') ? uri : undefined;
  } catch {
    return undefined;
  }
}

function clockIn(timezone: string) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date());
  } catch {
    return '';
  }
}

function relativeShort(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(minutes) || minutes < 2) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
