import type {
  Habit,
  Goodie,
  LogDay,
  MemoryItem,
  Moment,
  Note,
  Nudge,
  Presence,
  Question,
  Space,
  User,
} from '@/lib/types';

export const YOU_ID = 'you';
export const PARTNER_ID = 'partner';

const today = new Date('2026-08-20T09:00:00Z');
const iso = (d: Date) => d.toISOString();
const dayStr = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => {
  const d = new Date(today);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
};

export const you: User = {
  id: YOU_ID,
  displayName: 'You',
  emoji: '🌿',
  color: 'you',
  timezone: 'Africa/Lagos',
  photoSeed: 'weship-you',
};

export const partner: User = {
  id: PARTNER_ID,
  displayName: 'Riri',
  emoji: '🪻',
  color: 'them',
  timezone: 'Europe/Berlin',
  photoSeed: 'weship-riri',
};

export const space: Space = {
  id: 'space-1',
  name: 'Our space',
  memberIds: [YOU_ID, PARTNER_ID],
  mode: 'distance',
  anniversary: '2023-11-04',
  streak: { count: 6, lastActiveDate: dayStr(daysAgo(1)), graceLeft: 1 },
};

export const presences: Presence[] = [
  {
    userId: YOU_ID,
    mood: 'calm',
    statusText: 'Reading by the window',
    updatedAt: iso(daysAgo(0)),
  },
  {
    userId: PARTNER_ID,
    mood: 'missing',
    statusText: 'Long day — thinking of you',
    updatedAt: iso(daysAgo(0)),
    weather: { tempC: 17, label: 'Light rain', emoji: '🌦️' },
  },
];

export const notes: Note[] = [
  { id: 'n1', authorId: PARTNER_ID, text: 'Left you a good-morning note 🌅 drink some water!', createdAt: iso(daysAgo(0)), pinned: true },
  { id: 'n2', authorId: YOU_ID, text: 'Counting down to the 7th. 18 sleeps.', createdAt: iso(daysAgo(1)) },
  { id: 'n3', authorId: PARTNER_ID, text: 'That song you sent has been on repeat all day.', createdAt: iso(daysAgo(2)) },
];

// `uri` stays empty until real uploads exist; `seed` drives placeholder imagery.
export const moments: Moment[] = [
  { id: 'm1', authorId: PARTNER_ID, uri: '', seed: 'ws-sunrise', type: 'photo', caption: 'Sunrise walk', createdAt: iso(daysAgo(1)) },
  { id: 'm2', authorId: YOU_ID, uri: '', seed: 'ws-recipe', type: 'photo', caption: 'Cooked your recipe', createdAt: iso(daysAgo(3)) },
  { id: 'm3', authorId: PARTNER_ID, uri: '', seed: 'ws-fair', type: 'video', caption: 'Fair with friends', createdAt: iso(daysAgo(5)) },
  { id: 'm4', authorId: YOU_ID, uri: '', seed: 'ws-beach', type: 'photo', caption: 'Beach day', createdAt: iso(daysAgo(9)) },
  { id: 'm5', authorId: PARTNER_ID, uri: '', seed: 'ws-morning', type: 'photo', caption: 'Morning', createdAt: iso(daysAgo(12)) },
  { id: 'm6', authorId: YOU_ID, uri: '', seed: 'ws-flowers', type: 'photo', caption: 'For you', createdAt: iso(daysAgo(15)) },
];

export const goodies: Goodie[] = [
  {
    id: 'g1',
    authorId: PARTNER_ID,
    kind: 'photo',
    uri: '',
    text: 'The sky on my walk home',
    createdAt: iso(daysAgo(0)),
  },
  {
    id: 'g2',
    authorId: PARTNER_ID,
    kind: 'voice',
    // Public Expo documentation sample keeps the seeded playback control testable.
    uri: 'https://snack-code-uploads.s3.us-west-1.amazonaws.com/~asset/c9c43b458d6daa9771a7287cae9f5b47',
    text: 'A quick good-morning voice note',
    durationSeconds: 18,
    createdAt: iso(daysAgo(0)),
  },
  {
    id: 'g3',
    authorId: YOU_ID,
    kind: 'reminder',
    text: 'Call after dinner',
    createdAt: iso(daysAgo(0)),
  },
];

export const todayQuestion: Question = {
  id: 'q-today',
  promptDate: dayStr(today),
  text: 'What small thing did I do that made you feel loved this week?',
  // Partner has already answered — so "reveal on both" triggers once you answer.
  answers: {
    [PARTNER_ID]: {
      text: 'You called just to hear me breathe when I was stressed. That was everything.',
      answeredAt: iso(daysAgo(0)),
    },
  },
  revealed: false,
};

export const questionArchive: Question[] = [
  {
    id: 'q-1',
    promptDate: dayStr(daysAgo(1)),
    text: 'Where in the world do you most want to wake up together?',
    answers: {
      [YOU_ID]: { text: 'A quiet cabin with a lake and no signal.', answeredAt: iso(daysAgo(1)) },
      [PARTNER_ID]: { text: 'Somewhere with mountains and terrible wifi. Same page.', answeredAt: iso(daysAgo(1)) },
    },
    revealed: true,
  },
  {
    id: 'q-2',
    promptDate: dayStr(daysAgo(2)),
    text: 'What made you smile today?',
    answers: {
      [YOU_ID]: { text: 'Your voice note first thing in the morning.', answeredAt: iso(daysAgo(2)) },
      [PARTNER_ID]: { text: 'The photo of your terrible attempt at pancakes 🥞', answeredAt: iso(daysAgo(2)) },
    },
    revealed: true,
  },
];

/** Old enough that the missed-period tracker has something to show in demo mode. */
const SEEDED_AT = daysAgo(30).toISOString();

export const habits: Habit[] = [
  {
    id: 'h-check-in',
    label: 'Have an intentional check-in',
    icon: '💬',
    color: '#5C7F58',
    routine: 'daily',
    noteRequired: false,
    createdAt: SEEDED_AT,
  },
  {
    id: 'h-highlight',
    label: 'Share one highlight from today',
    icon: '✨',
    color: '#6C9A93',
    routine: 'daily',
    noteRequired: true,
    createdAt: SEEDED_AT,
  },
  {
    id: 'h-quality-time',
    label: 'Plan quality time together',
    icon: '🫶',
    color: '#CBA04E',
    routine: 'weekly',
    noteRequired: true,
    createdAt: SEEDED_AT,
  },
  {
    id: 'h-kindness',
    label: 'Do one thoughtful thing for each other',
    icon: '💛',
    color: '#9DBCC7',
    routine: 'weekly',
    noteRequired: true,
    createdAt: SEEDED_AT,
  },
  {
    id: 'h-memory',
    label: 'Save a favorite moment together',
    icon: '📷',
    color: '#D2848A',
    routine: 'monthly',
    noteRequired: true,
    createdAt: SEEDED_AT,
  },
];

// Seven days of log history (older days more complete than recent).
export const logHistory: LogDay[] = Array.from({ length: 7 }).map((_, i) => {
  const n = 6 - i; // n days ago, oldest first
  const done = (p: number) => Math.random() < p;
  return {
    date: dayStr(daysAgo(n)),
    mood: {
      [YOU_ID]: (['calm', 'sunny', 'tired', 'loved', 'calm', 'missing', 'calm'] as const)[i],
      [PARTNER_ID]: (['sunny', 'loved', 'low', 'calm', 'missing', 'tired', 'missing'] as const)[i],
    },
    habits: {
      'h-check-in': { [YOU_ID]: n > 0, [PARTNER_ID]: n > 0 },
      'h-highlight': { [YOU_ID]: done(0.7), [PARTNER_ID]: done(0.7) },
      'h-quality-time': { [YOU_ID]: done(0.6), [PARTNER_ID]: done(0.5) },
      'h-kindness': { [YOU_ID]: done(0.6), [PARTNER_ID]: done(0.6) },
    },
  };
});

export const nudges: Nudge[] = [
  { id: 'nu1', fromId: PARTNER_ID, kind: 'thinkingOfYou', createdAt: iso(daysAgo(0)), seen: false },
];

export const onThisDay: MemoryItem = {
  id: 'mem1',
  kind: 'moment',
  title: 'One year ago today',
  subtitle: 'The evening you first said it back 🍂',
  date: '2025-08-20',
  uri: '',
};

export const memories: MemoryItem[] = [
  onThisDay,
  { id: 'mem2', kind: 'question', title: 'Answered together', subtitle: '“Where do you want to wake up?”', date: dayStr(daysAgo(1)) },
  { id: 'mem3', kind: 'milestone', title: '18 days', subtitle: 'Until you’re together again', date: dayStr(today) },
  { id: 'mem4', kind: 'moment', title: 'Beach day', subtitle: 'You posted a moment', date: dayStr(daysAgo(9)) },
];

export const CADENCE_DATE = dayStr(today);
