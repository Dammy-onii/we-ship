/** Gender options offered at sign-up. Optional — "prefer_not_to_say" is a real choice. */

export type GenderKey = 'woman' | 'man' | 'non_binary' | 'prefer_not_to_say';

export const GENDERS: { key: GenderKey; label: string }[] = [
  { key: 'woman', label: 'Woman' },
  { key: 'man', label: 'Man' },
  { key: 'non_binary', label: 'Non-binary' },
  { key: 'prefer_not_to_say', label: 'Rather not say' },
];

export const genderLabel = (key?: string | null) =>
  GENDERS.find((option) => option.key === key)?.label;
