import type { WidgetSnapshot } from '@/lib/widget-snapshot';

export type TopIncompleteTask = { label: string; routine: string } | null;
export type WidgetAction = { type: string; id: string; at: number };
export type WidgetSession = {
  url: string;
  anonKey: string;
  accessToken: string;
  timezone: string;
};

export function syncTopTodoWidget(_task: TopIncompleteTask) {
  // Home-screen widgets are native surfaces and are unavailable on web.
}

export function syncWidgetSnapshot(_snapshot: WidgetSnapshot) {}

export function setWidgetSession(_session: WidgetSession | null) {}

/** Widget kinds the user can add. Empty on web. */
export const WIDGET_KINDS: string[] = [];

/** iOS has no public API for adding a widget, so the UI guides the user. */
export async function requestWidgetPin(_kind?: string): Promise<boolean> {
  return false;
}

/** Actions queued by a widget button while offline, flushed on next launch. */
export async function drainWidgetActions(): Promise<WidgetAction[]> {
  return [];
}

export async function acknowledgeWidgetActions(_actions: WidgetAction[]): Promise<void> {}

/** In-widget button presses. Never fires on web. */
export function onWidgetInteraction(_handler: (target: string) => void): () => void {
  return () => {};
}
