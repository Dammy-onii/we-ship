import type { WidgetEnvironment } from 'expo-widgets';

/** Widget palette. Mirrors the Android `values/colors.xml` so both feel alike. */
export function widgetTheme(environment: WidgetEnvironment) {
  const dark = environment.colorScheme === 'dark';
  return {
    dark,
    background: dark ? '#1C1C1C' : '#F3F1EC',
    text: dark ? '#F2F0EB' : '#252321',
    secondary: dark ? '#AAA7A2' : '#706C67',
    accent: dark ? '#CBC6BE' : '#5F5B57',
    onPhoto: '#FFFCF7',
    compact: environment.widgetFamily === 'systemSmall',
    lockScreen:
      environment.widgetFamily === 'accessoryCircular' ||
      environment.widgetFamily === 'accessoryRectangular' ||
      environment.widgetFamily === 'accessoryInline',
  };
}

export type CarouselWidgetProps = {
  /** Slides, already JSON-encoded — widget props must be plain values. */
  slides: string;
  title: string;
  deepLink: string;
};

export type Slide = {
  id: string;
  kind: 'photo' | 'video' | 'note';
  imageUri?: string;
  text?: string;
  author: string;
  pinned?: boolean;
};

export function parseSlides(raw: string): Slide[] {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? (parsed as Slide[]) : [];
  } catch {
    return [];
  }
}

/**
 * Which slide to show right now.
 *
 * WidgetKit has no swipe gesture, so the carousel advances on its own clock:
 * the entry index is derived from the current time, and the timeline supplies
 * one entry per step. Paging buttons cover the "I want the next one now" case.
 */
export function slideIndexForNow(count: number, stepMinutes = 15) {
  if (count <= 0) return 0;
  const step = Math.floor(Date.now() / (stepMinutes * 60_000));
  return step % count;
}
