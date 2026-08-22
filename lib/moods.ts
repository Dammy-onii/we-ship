/** Shared mood vocabulary — used by presence, the log, and check-ins. */

export type MoodKey = 'loved' | 'sunny' | 'calm' | 'tired' | 'low' | 'missing';

export type MoodDef = { key: MoodKey; label: string; emoji: string; color: string };

export const MOODS: MoodDef[] = [
  { key: 'loved', label: 'Loved', emoji: '🌸', color: '#D2848A' },
  { key: 'sunny', label: 'Sunny', emoji: '🌻', color: '#CBA04E' },
  { key: 'calm', label: 'Calm', emoji: '🌿', color: '#5C7F58' },
  { key: 'tired', label: 'Tired', emoji: '🌙', color: '#6C9A93' },
  { key: 'missing', label: 'Missing', emoji: '🍂', color: '#BC7A4D' },
  { key: 'low', label: 'Low', emoji: '🌧️', color: '#9DBCC7' },
];

export const moodOf = (key: MoodKey): MoodDef =>
  MOODS.find((m) => m.key === key) ?? MOODS[2];
