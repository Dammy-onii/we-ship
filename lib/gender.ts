/**
 * Gender options offered at sign-up.
 *
 * Optional throughout — "prefer_not_to_say" is a real choice, and leaving the
 * field untouched is also allowed. The keys are the values the `profiles`
 * gender check constraint accepts.
 */

export type GenderKey = 'male' | 'female' | 'prefer_not_to_say';

export const GENDERS: { key: GenderKey; label: string }[] = [
  { key: 'male', label: 'Male' },
  { key: 'female', label: 'Female' },
  { key: 'prefer_not_to_say', label: 'Prefer not to say' },
];

export const genderLabel = (key?: string | null) =>
  GENDERS.find((option) => option.key === key)?.label;
