import { requireOptionalNativeModule } from 'expo';

import type { WidgetSnapshot } from '@/lib/widget-snapshot';

export type TopIncompleteTask = { label: string; routine: string } | null;

type WeshipWidgetModule = {
  setTopTask(title: string | null, routine: string | null, deepLink: string): Promise<void>;
  setSnapshot(json: string): Promise<void>;
  setSession(json: string | null): Promise<void>;
  requestPin(kind: string): Promise<boolean>;
  availableKinds(): Promise<string[]>;
  drainActions(): Promise<string>;
};

const widget = requireOptionalNativeModule<Partial<WeshipWidgetModule>>('WeshipTodoWidget');

/**
 * Calls a native method only if this build actually has it.
 *
 * `requireOptionalNativeModule` tells us the module exists, not which methods
 * it exposes: a dev build installed before these functions were added still
 * resolves the module, and calling a missing method throws hard enough to take
 * the app down at launch. Every widget call goes through here so an older build
 * degrades to "no widgets" instead of crashing.
 */
function call<K extends keyof WeshipWidgetModule>(
  name: K,
  ...args: Parameters<WeshipWidgetModule[K]>
): Promise<ReturnType<WeshipWidgetModule[K]>> | null {
  const method = widget?.[name] as ((...a: unknown[]) => Promise<never>) | undefined;
  if (typeof method !== 'function') return null;
  try {
    return Promise.resolve(method.apply(widget, args)) as Promise<
      ReturnType<WeshipWidgetModule[K]>
    >;
  } catch {
    return null;
  }
}

export function syncTopTodoWidget(task: TopIncompleteTask) {
  call('setTopTask', task?.label ?? null, task?.routine ?? null, 'weship://todo')?.catch(() => {});
}

export function syncWidgetSnapshot(snapshot: WidgetSnapshot) {
  call('setSnapshot', JSON.stringify(snapshot))?.catch(() => {});
}

/**
 * Widget buttons run in a process with no Supabase client, so the app hands
 * down the minimum needed to call one RPC directly: the project URL, the
 * publishable key, and the current access token. Refreshed on every auth
 * change, and cleared on sign-out so a signed-out phone cannot act.
 */
export function setWidgetSession(
  session: { url: string; anonKey: string; accessToken: string } | null,
) {
  call('setSession', session ? JSON.stringify(session) : null)?.catch(() => {});
}

/*
 * Android widgets are hand-written `AppWidgetProvider`s in
 * `modules/weship-todo-widget`, not `expo-widgets` surfaces, so a kind only
 * belongs here once it has a provider and a manifest receiver. Keep this list
 * in step with `WeshipWidgets.providers`.
 */
export const WIDGET_KINDS = [
  'partner-carousel',
  'friends-carousel',
  'presence',
  'quick-send',
  'todo',
];

/** Asks the launcher to pin a widget. False means show manual steps instead. */
export async function requestWidgetPin(kind = 'todo'): Promise<boolean> {
  try {
    return (await call('requestPin', kind)) ?? false;
  } catch {
    return false;
  }
}

/** Actions a widget button could not send (expired token, offline). */
export async function drainWidgetActions(): Promise<{ type: string; id: string; at: number }[]> {
  try {
    const raw = await call('drainActions');
    return raw ? (JSON.parse(raw) as { type: string; id: string; at: number }[]) : [];
  } catch {
    return [];
  }
}

/**
 * In-widget button presses.
 *
 * Android has no equivalent listener: its widget buttons fire a broadcast the
 * native receiver handles directly, and anything needing the app is queued for
 * `drainWidgetActions`. Present so callers can stay platform-agnostic.
 */
export function onWidgetInteraction(_handler: (target: string) => void): () => void {
  return () => {};
}
