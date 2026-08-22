import { requireOptionalNativeModule } from 'expo';

import type { WidgetSnapshot } from '@/lib/widget-snapshot';

export type TopIncompleteTask = { label: string; routine: string } | null;

/**
 * `expo-widgets` widgets are separate typed surfaces, so the snapshot is
 * fanned out to each rather than written as one blob. Every import is lazy:
 * the module throws where the native side is absent, and a top-level import
 * that throws takes down the router (see AGENTS.md).
 */
type WidgetSurface = {
  updateSnapshot(props: object): void;
  updateTimeline(entries: { date: Date; props: object }[]): void;
};

function widget(load: () => { default: unknown }): WidgetSurface | null {
  if (!requireOptionalNativeModule('ExpoWidgets')) return null;
  try {
    const surface = load().default as { updateSnapshot?: unknown } | undefined;
    // A build made before this widget existed resolves the module but not the
    // surface, and calling a missing method takes the app down at launch.
    return surface && typeof surface.updateSnapshot === 'function'
      ? (surface as WidgetSurface)
      : null;
  } catch {
    return null;
  }
}

/** Never throws: one missing widget must not cost the whole snapshot. */
function push(load: () => { default: unknown }, props: object) {
  try {
    const surface = widget(load);
    if (!surface) return;
    // Keep time-relative and carousel widgets redrawing while the app sleeps.
    // Remote activity also sends a background push which replaces this
    // timeline with freshly fetched content.
    if (typeof surface.updateTimeline === 'function') {
      const now = Date.now();
      surface.updateTimeline(Array.from({ length: 49 }, (_, hour) => ({
        date: new Date(now + hour * 60 * 60 * 1000),
        props,
      })));
    } else {
      surface.updateSnapshot(props);
    }
  } catch {
    // Older build, or a surface this version does not ship.
  }
}

export function syncTopTodoWidget(task: TopIncompleteTask) {
  push(() => require('./TopTodoWidget'), {
    title: task?.label ?? 'All caught up',
    routine: task?.routine ?? '',
    empty: !task,
  });
}

export function syncWidgetSnapshot(snapshot: WidgetSnapshot) {
  push(() => require('./PartnerCarouselWidget'), {
    slides: JSON.stringify(snapshot.partnerSlides),
    title: 'Us',
    deepLink: 'weship://spotlight',
  });
  push(() => require('./FriendsCarouselWidget'), {
    slides: JSON.stringify(snapshot.friendSlides),
    title: 'Friends',
    deepLink: 'weship://friend-spotlight',
  });
  if (snapshot.presence) {
    push(() => require('./PresenceWidget'), {
      name: snapshot.presence.name,
      mood: snapshot.presence.mood,
      moodEmoji: snapshot.presence.moodEmoji,
      statusText: snapshot.presence.statusText ?? '',
      // Empty on purpose for same-timezone couples: their clock is your clock.
      localTime: snapshot.presence.localTime ?? '',
      lastSeen: snapshot.presence.lastSeen,
    });
    push(() => require('./NudgeWidget'), {
      partnerName: snapshot.presence.name,
      justSent: false,
    });
  }
  if (snapshot.streak) {
    push(() => require('./StreakQuestionWidget'), snapshot.streak);
  }
}

/** iOS performs widget actions in-app via the interaction listener. */
export function setWidgetSession(_session: { url: string; anonKey: string; accessToken: string } | null) {}

export const WIDGET_KINDS = [
  'partner-carousel',
  'friends-carousel',
  'presence',
  'streak-question',
  'nudge',
  'todo',
];

/**
 * iOS exposes no API for adding a widget — Apple permits it only from the home
 * screen. Reported honestly so the caller can say so rather than pretend.
 */
export async function requestWidgetPin(_kind?: string): Promise<boolean> {
  return false;
}

/** Nothing is queued on iOS: AppIntents wake the app, which acts immediately. */
export async function drainWidgetActions(): Promise<{ type: string; id: string; at: number }[]> {
  return [];
}

/**
 * Bridges an in-widget button press back into the app.
 *
 * `target` is the string set on the `Button`, e.g. `nudge:heart`.
 */
export function onWidgetInteraction(handler: (target: string) => void) {
  // Imported lazily: `expo-widgets` throws at module load where the native side
  // is absent, and a top-level import that throws takes down the router.
  try {
    const { addUserInteractionListener } = require('expo-widgets') as typeof import('expo-widgets');
    return addUserInteractionListener((event) => handler(event.target));
  } catch {
    return { remove() {} };
  }
}
