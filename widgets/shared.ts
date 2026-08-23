import type { WidgetEnvironment } from 'expo-widgets';

/**
 * Widget palette, taken from the app's own `Palette` in `constants/theme.ts`.
 *
 * The values are copied rather than imported: a widget builds into a separate
 * bundle, and Android's `res/values/colors.xml` cannot read TypeScript at all,
 * so three copies is the floor. **Keep all three in step** — they drifted
 * before, and the accent in particular had become a neutral grey while the app
 * had moved to warm umber, which made the widgets look like a different product.
 */
export function widgetTheme(environment: WidgetEnvironment) {
  return {
    /*
     * Light in every scheme, deliberately.
     *
     * The app is locked to light (`AppColorScheme`, and `userInterfaceStyle` in
     * app.json), so a widget that followed the system would go dark beside an
     * app that never does. A warm paper tile sits perfectly well on a dark home
     * screen; a widget that does not look like its own app does not.
     */
    dark: false,
    // Palette.light.bg
    background: '#F6F3EE',
    /** Raised fill for tappable regions inside a widget. Palette.light.surface */
    surface: '#FCFAF7',
    // Palette.light.text
    text: '#262625',
    // Palette.light.textSoft
    secondary: '#5F5D59',
    // Palette.light.primary — the app's signature warm umber, not a grey.
    accent: '#704936',
    // Palette.light.onPrimary. Sits over photography.
    onPhoto: '#FCFAF7',
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
  /**
   * How far the paging buttons have moved from the automatic position.
   *
   * A widget cannot hold its own state, so the offset lives in the app: the
   * button hands its target to `addUserInteractionListener`, the app bumps this
   * and pushes a new snapshot. That round trip is why paging is a nudge to the
   * rotation rather than an instant flick.
   */
  offset: number;
  /** Shown when there is nothing to display — each surface words it differently. */
  emptyTitle: string;
  emptyBody: string;
  emptyLink: string;
};

export type Slide = {
  id: string;
  kind: 'photo' | 'video' | 'note';
  imageUri?: string;
  text?: string;
  author: string;
  favourite?: boolean;
  route: string;
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
export function slideIndexForNow(count: number, offset = 0, stepMinutes = 15) {
  if (count <= 0) return 0;
  const step = Math.floor(Date.now() / (stepMinutes * 60_000));
  // `% count` twice: JavaScript's remainder keeps the sign, so stepping back
  // past the first slide would otherwise produce a negative index.
  return (((step + offset) % count) + count) % count;
}
