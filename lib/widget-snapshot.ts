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
  /** Favourited slides lead the carousel and are marked in the UI. */
  favourite?: boolean;
  /**
   * Deep link for this slide, so tapping lands on the item rather than the top
   * of the gallery. A full `weship://` URL — a widget opens a URL, not a route.
   */
  route: string;
};

/** One row in the 2do widget's list. */
export type WidgetTask = {
  id: string;
  label: string;
  routine: string;
  noteRequired: boolean;
  /** Whether you have ticked it for the current period. */
  done: boolean;
};

export type WidgetSnapshot = {
  /**
   * The single next task, for the small size and for Presence.
   *
   * Kept alongside `todos` rather than derived from it, because the small
   * layout has no list to derive from.
   */
  todo: { id: string; label: string; routine: string; noteRequired: boolean } | null;
  /** Every shared task, open ones first, for the scrollable list. */
  todos: WidgetTask[];
  presence: {
    name: string;
    mood: string;
    moodEmoji: string;
    statusText?: string;
    /** Their clock, or null when you share a timezone and it would be your own. */
    localTime: string | null;
    /** Shown instead of the clock for same-timezone couples. */
    lastSeen: string;
    /**
     * The last thing that passed between the two of you, e.g. "They sent a
     * photo · 2h ago". Replaces the clock when a shared timezone makes it
     * meaningless, and says something on a day nothing else has.
     */
    lastExchange: string;
    /** The next unfinished shared 2do, so the widget carries something to act on. */
    pendingTask: string;
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
  /**
   * How far each carousel's paging buttons have moved it from the automatic
   * position. Held here because a widget cannot keep state of its own.
   */
  carouselOffset: { partner: number; friends: number };
  updatedAt: string;
};

const MAX_SLIDES = 12;

export const EMPTY_SNAPSHOT: WidgetSnapshot = {
  todo: null,
  todos: [],
  presence: null,
  streak: null,
  partnerSlides: [],
  friendSlides: [],
  carouselOffset: { partner: 0, friends: 0 },
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
  carouselOffset?: { partner: number; friends: number };
  favourite?: { kind: 'photo' | 'note'; body?: string; uri?: string } | null;
};

export async function buildWidgetSnapshot(input: BuildInput): Promise<WidgetSnapshot> {
  const todos: WidgetTask[] = input.habits.map((habit) => ({
    id: habit.id,
    label: habit.label,
    routine: habit.routine,
    noteRequired: habit.noteRequired,
    done: input.todayLog?.habits[habit.id]?.[input.meId] ?? false,
  }));
  // Open work first; what is already ticked stays reachable below it rather
  // than disappearing, so the widget can show a finished list as finished.
  const orderedTodos = [...todos].sort((a, b) => Number(a.done) - Number(b.done));
  const todoTask = todos.find((task) => !task.done);

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
    todos: orderedTodos,
    presence: {
      name: input.partner.displayName,
      mood: mood.label,
      moodEmoji: mood.emoji,
      statusText: input.presence.statusText,
      localTime: sameZone ? null : clockIn(input.partner.timezone),
      lastSeen: relativeShort(input.presence.updatedAt),
      lastExchange: describeLastExchange(input.goodies, input.meId),
      pendingTask: todoTask?.label ?? '',
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
    carouselOffset: input.carouselOffset ?? { partner: 0, friends: 0 },
    updatedAt: new Date().toISOString(),
  };
}

async function buildPartnerSlides(input: BuildInput): Promise<CarouselSlide[]> {
  const slides: CarouselSlide[] = [];

  // A partner's favourite always leads, so pushing something to their home
  // screen actually shows up first rather than competing with the newest Goodie.
  if (input.favourite) {
    slides.push({
      id: 'favourite',
      kind: input.favourite.kind === 'photo' ? 'photo' : 'note',
      text: input.favourite.body,
      imageUri: input.favourite.uri
        ? await localCopy('favourite', input.favourite.kind, input.favourite.uri)
        : undefined,
      author: input.partner.displayName,
      favourite: true,
      route: 'weship://spotlight',
    });
  }

  for (const goodie of input.goodies) {
    if (slides.length >= MAX_SLIDES) break;
    if (goodie.kind !== 'photo' && goodie.kind !== 'video' && goodie.kind !== 'note') continue;
    // A photo whose bytes never arrived would render as a blank slide.
    if (goodie.kind !== 'note' && !goodie.uri) continue;
    const author = goodie.authorId === input.meId ? input.me : input.partner;
    slides.push({
      id: goodie.id,
      kind: goodie.kind,
      text: goodie.text,
      imageUri: goodie.uri ? await localCopy(goodie.id, goodie.kind, goodie.uri) : undefined,
      author: author.displayName,
      // Lands on this exact item rather than the top of the gallery.
      route: `weship://spotlight?item=${encodeURIComponent(goodie.id)}`,
    });
  }

  return slides;
}

/**
 * The friends carousel: everyone's most recent post, in a daily-shuffled order.
 *
 * One per friend so a prolific poster cannot crowd the others out, and shuffled
 * rather than newest-first so the same person is not permanently on top. Your
 * own posts are excluded — this widget is for seeing other people.
 */
type CarouselPost = FriendPost & { kind: 'photo' | 'video' | 'note' };

async function buildFriendSlides(posts: FriendPost[]): Promise<CarouselSlide[]> {
  const newestPerFriend = new Map<string, CarouselPost>();
  for (const post of posts) {
    if (post.mine) continue;
    if (post.kind !== 'photo' && post.kind !== 'video' && post.kind !== 'note') continue;
    if (post.kind !== 'note' && !post.uri) continue;
    const carouselPost = post as CarouselPost;
    const existing = newestPerFriend.get(post.author.id);
    if (!existing || carouselPost.createdAt > existing.createdAt) {
      newestPerFriend.set(post.author.id, carouselPost);
    }
  }

  const ordered = shuffleForToday([...newestPerFriend.values()]).slice(0, MAX_SLIDES);

  const slides: CarouselSlide[] = [];
  for (const post of ordered) {
    const imageUri = post.uri
      ? await localCopy(post.id, post.kind, post.uri, 'friend')
      : undefined;
    // Friend media is pruned after two days. A photo whose bytes are gone would
    // draw as an empty frame, so it drops out rather than showing a hole.
    if (post.kind !== 'note' && !imageUri) continue;
    slides.push({
      id: post.id,
      kind: post.kind,
      text: post.text,
      imageUri,
      author: post.author.displayName,
      route: `weship://friend-spotlight?item=${encodeURIComponent(post.id)}`,
    });
  }
  return slides;
}

/**
 * A stable shuffle that changes once a day.
 *
 * Seeded by the date so every redraw within a day keeps the same order — a
 * carousel that reshuffled on each refresh would jump around while being read.
 */
function shuffleForToday<T extends { id: string }>(items: T[]): T[] {
  const day = Math.floor(Date.now() / 86_400_000);
  return items
    .map((item) => {
      let hash = day;
      for (const character of item.id) hash = (hash * 31 + character.charCodeAt(0)) | 0;
      return { item, rank: hash };
    })
    .sort((a, b) => a.rank - b.rank)
    .map((entry) => entry.item);
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

const EXCHANGE_LABELS: Record<string, string> = {
  photo: 'a photo',
  video: 'a video',
  voice: 'a voice note',
  note: 'a note',
  reminder: 'a reminder',
};

/**
 * The most recent thing either of you sent, in words.
 *
 * Deliberately covers both directions: a line that only ever reported *their*
 * activity turned the widget into a monitor. Seeing "You sent a photo" is a
 * reminder of the last exchange, not a report on a person.
 */
function describeLastExchange(goodies: Goodie[], meId: string): string {
  const latest = goodies.reduce<Goodie | undefined>(
    (newest, goodie) => (!newest || goodie.createdAt > newest.createdAt ? goodie : newest),
    undefined,
  );
  if (!latest) return '';
  const who = latest.authorId === meId ? 'You sent' : 'They sent';
  return `${who} ${EXCHANGE_LABELS[latest.kind] ?? 'something'} · ${relativeShort(latest.createdAt)}`;
}

function relativeShort(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(minutes) || minutes < 2) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
