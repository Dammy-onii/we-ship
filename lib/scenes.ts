import type { Scenario } from './types';

/** A Scene Challenge pack: a themed prompt plus the scenarios you rank on camera. */
export type ScenePack = {
  id: string;
  theme: string;
  prompt: string;
  scenarios: Scenario[];
};

export const SCENE_PACKS: ScenePack[] = [
  {
    id: 'date-night-draft',
    theme: 'Date Night Draft',
    prompt: 'Rank these date nights — 1 is our dream, last is “maybe someday”.',
    scenarios: [
      { id: 's1', label: 'Cozy night in, movie + takeout', emoji: '🍿' },
      { id: 's2', label: 'Road trip with no plan', emoji: '🚗' },
      { id: 's3', label: 'Fancy dinner, dressed up', emoji: '🍷' },
      { id: 's4', label: 'Hiking to a viewpoint', emoji: '🥾' },
      { id: 's5', label: 'Dancing till late', emoji: '💃' },
    ],
  },
  {
    id: 'travel-dreams',
    theme: 'Where To Next',
    prompt: 'Rank the trips — 1 is where we go first.',
    scenarios: [
      { id: 't1', label: 'A quiet cabin by a lake', emoji: '🛶' },
      { id: 't2', label: 'A busy city we’ve never seen', emoji: '🌆' },
      { id: 't3', label: 'Somewhere warm with a beach', emoji: '🏝️' },
      { id: 't4', label: 'A long train through mountains', emoji: '🚞' },
      { id: 't5', label: 'Back to where we first met', emoji: '📍' },
    ],
  },
  {
    id: 'little-things',
    theme: 'The Little Things',
    prompt: 'Rank what makes an ordinary day better — 1 matters most.',
    scenarios: [
      { id: 'l1', label: 'A long good-morning message', emoji: '🌅' },
      { id: 'l2', label: 'Cooking something together', emoji: '🍳' },
      { id: 'l3', label: 'A random “thinking of you”', emoji: '💭' },
      { id: 'l4', label: 'Sharing a song you found', emoji: '🎧' },
      { id: 'l5', label: 'An unplanned video call', emoji: '📱' },
    ],
  },
  {
    id: 'someday-us',
    theme: 'Someday, Us',
    prompt: 'Rank the someday plans — 1 is what you want soonest.',
    scenarios: [
      { id: 'd1', label: 'A home that’s fully ours', emoji: '🏡' },
      { id: 'd2', label: 'A pet with a ridiculous name', emoji: '🐕' },
      { id: 'd3', label: 'A trip we save a year for', emoji: '✈️' },
      { id: 'd4', label: 'A tradition only we have', emoji: '🕯️' },
      { id: 'd5', label: 'Learning something together', emoji: '📚' },
    ],
  },
];

export const getScenePack = (id?: string): ScenePack =>
  SCENE_PACKS.find((pack) => pack.id === id) ?? SCENE_PACKS[0];
