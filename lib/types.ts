import type { MoodKey } from './moods';

export type ID = string;
export type ISODate = string; // YYYY-MM-DD
export type ISODateTime = string;

export type User = {
  id: ID;
  displayName: string;
  emoji: string;
  color: 'you' | 'them';
  timezone: string; // IANA
  /** Stable seed for the portrait until real uploads exist. */
  photoSeed: string;
  /** Signed or local profile image URI when the live backend is connected. */
  photoUri?: string;
  /** Unique handle people are searched by. Absent in demo mode. */
  username?: string;
  /** Optional; one of the keys in `lib/gender.ts`. */
  gender?: string;
};

export type SpaceMode = 'together' | 'distance';

export type Space = {
  id: ID;
  memberIds: [ID, ID];
  mode: SpaceMode;
  anniversary?: ISODate;
  streak: { count: number; lastActiveDate: ISODate; graceLeft: number };
};

export type Presence = {
  userId: ID;
  mood: MoodKey;
  statusText?: string;
  updatedAt: ISODateTime;
  weather?: { tempC: number; label: string; emoji: string };
};

export type Note = {
  id: ID;
  authorId: ID;
  text: string;
  createdAt: ISODateTime;
  pinned?: boolean;
};

export type Moment = {
  id: ID;
  authorId: ID;
  uri: string;
  /** Stable seed for placeholder imagery until real uploads exist. */
  seed: string;
  type: 'photo' | 'video';
  caption?: string;
  createdAt: ISODateTime;
  /** The full-resolution original is ready in its owner's Google Drive. */
  originalAvailable?: boolean;
  width?: number;
  height?: number;
};

export type GoodieKind = 'photo' | 'video' | 'voice' | 'note' | 'reminder';

export type Goodie = {
  id: ID;
  authorId: ID;
  kind: GoodieKind;
  createdAt: ISODateTime;
  text?: string;
  uri?: string;
  durationSeconds?: number;
  reminderAt?: ISODateTime;
  /** The photo/video original is ready in its owner's Google Drive. */
  originalAvailable?: boolean;
  width?: number;
  height?: number;
};

export type Question = {
  id: ID;
  promptDate: ISODate;
  text: string;
  answers: Record<ID, { text: string; answeredAt: ISODateTime }>;
  revealed: boolean;
};

export type QuestionPrompt = {
  id: ID;
  text: string;
  createdBy: ID;
  createdAt: ISODateTime;
};

export type Scenario = { id: ID; label: string; emoji: string };

export type SceneChallenge = {
  id: ID;
  theme: string;
  prompt: string;
  scenarios: Scenario[];
  ranking: Record<ID, ID[]>; // userId -> ordered scenario ids
  createdAt: ISODateTime;
};

export type TaskRoutine = 'daily' | 'weekly' | 'monthly';

export type Habit = {
  id: ID;
  label: string;
  icon: string;
  color: string;
  routine: TaskRoutine;
  noteRequired: boolean;
};

export type LogDay = {
  date: ISODate;
  mood: Partial<Record<ID, MoodKey>>;
  habits: Record<string, Partial<Record<ID, boolean>>>; // habitId -> userId -> done
};

export type Nudge = {
  id: ID;
  fromId: ID;
  kind: 'thinkingOfYou' | 'heart' | 'hug' | 'goodnight';
  createdAt: ISODateTime;
  seen: boolean;
};

export type MemoryItem = {
  id: ID;
  kind: 'moment' | 'question' | 'milestone';
  title: string;
  subtitle: string;
  date: ISODate;
  uri?: string;
};

/**
 * Friends are a second connection graph, independent of the pair Space.
 * A user has at most one partner but any number of friends.
 */
export type FriendStatus = 'none' | 'outgoing' | 'incoming' | 'friends';

export type PersonSummary = {
  id: ID;
  displayName: string;
  username: string;
  photoUri?: string;
  status: FriendStatus;
};

export type FriendRequest = {
  id: ID;
  person: PersonSummary;
  createdAt: ISODateTime;
  direction: 'incoming' | 'outgoing';
};

export type FriendPostKind = 'photo' | 'video' | 'voice' | 'note';

export type FriendPost = {
  id: ID;
  author: PersonSummary;
  kind: FriendPostKind;
  text?: string;
  uri?: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
  createdAt: ISODateTime;
  mine: boolean;
};

/** Where a composed item is sent. At least one must be selected. */
export type PostAudience = { partner: boolean; friends: boolean };
