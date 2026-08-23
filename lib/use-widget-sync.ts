import { useCallback, useEffect, useRef, useState } from 'react';

import {
  drainWidgetActions,
  onWidgetInteraction,
  setWidgetSession,
  syncWidgetSnapshot,
} from '@/widgets';
import { useAuth } from './auth';
import { backendConfig } from './backend/config';
import { fetchWidgetFavourite } from './backend/repository';
import { useFriends } from './friends';
import { PARTNER_ID, useWidgetData, YOU_ID } from './store';
import { buildWidgetSnapshot } from './widget-snapshot';

/**
 * Keeps the home-screen widgets in step with the app.
 *
 * Mounted once, inside both providers: the snapshot spans the pair Space *and*
 * the friend board, which live in separate contexts by design.
 */
export function useWidgetSync() {
  const auth = useAuth();
  const data = useWidgetData();
  const friends = useFriends();
  const lastPayload = useRef<string | undefined>(undefined);

  // Widget buttons post to one RPC directly, so they need a token. Refreshed
  // on every auth change and cleared on sign-out.
  const accessToken = auth.session?.access_token;
  const userId = auth.user?.id;
  const [carouselOffset, setCarouselOffset] = useState({ partner: 0, friends: 0 });
  useEffect(() => {
    // Nothing here is worth crashing the app for: this component sits inside
    // the provider tree with no error boundary above it, so a throw would take
    // the whole UI down rather than just costing a widget update.
    try {
      if (!accessToken || !backendConfig.supabaseUrl || !backendConfig.supabaseKey) {
        setWidgetSession(null);
        return;
      }
      setWidgetSession({
        url: backendConfig.supabaseUrl,
        anonKey: backendConfig.supabaseKey,
        accessToken,
      });
    } catch {
      // Older native build without this method.
    }
  }, [accessToken]);

  /*
   * In-widget button presses (iOS 17+).
   *
   * Nothing registered a handler before this, so the Nudge widget's buttons and
   * the carousel arrows had nowhere to land — the widget fired an event the app
   * never listened for.
   *
   * A widget cannot hold state, so paging is a round trip: the button reports
   * its target, the app moves the offset, and the next snapshot redraws the
   * widget. Offsets are in-memory on purpose — a relaunch should return the
   * carousel to following the clock rather than resuming yesterday's browsing.
   */
  const handleInteraction = useCallback((target: string) => {
    const [kind, surface, direction] = target.split(':');
    if (kind !== 'carousel' || (surface !== 'partner' && surface !== 'friends')) return;
    const step = direction === 'prev' ? -1 : 1;
    setCarouselOffset((current) => ({ ...current, [surface]: current[surface] + step }));
  }, []);

  useEffect(() => onWidgetInteraction(handleInteraction), [handleInteraction]);

  /**
   * Flushes taps a widget button could not deliver — expired token, offline,
   * or the app was not running. A tap must never be silently lost, so the
   * widget queues locally and the app replays here.
   */
  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    Promise.resolve()
      .then(drainWidgetActions)
      .then(async (actions) => {
        if (cancelled || !actions.length) return;
        const { setTaskComplete, sendWidgetNudge } = await import('./backend/repository');
        for (const item of actions) {
          try {
            if (item.type === 'complete_task') await setTaskComplete(item.id, true);
            if (item.type === 'nudge') await sendWidgetNudge(item.id);
          } catch {
            // Replaying is best-effort; the app's own state stays correct.
          }
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    let cancelled = false;
    if (!data.me || !data.partner) return;

    Promise.resolve()
      // The favourite lives on the server, not in the store: it is written by
      // the *partner*, so nothing local ever changes when they set one.
      .then(() => (userId ? fetchWidgetFavourite(userId).catch(() => null) : null))
      .then((favourite) =>
        buildWidgetSnapshot({
          me: data.me,
          partner: data.partner,
          space: data.space,
          presence: data.presence ?? {
            userId: PARTNER_ID,
            mood: 'calm',
            updatedAt: new Date().toISOString(),
          },
          question: data.question,
          habits: data.habits,
          todayLog: data.todayLog,
          goodies: data.goodies,
          friendPosts: friends.posts,
          meId: YOU_ID,
          partnerId: PARTNER_ID,
          favourite,
          carouselOffset,
        }),
      )
      .then((snapshot) => {
        if (cancelled) return;
        // Writing the snapshot forces every placed widget to redraw, so only
        // push when something actually changed.
        const payload = JSON.stringify({ ...snapshot, updatedAt: undefined });
        if (payload === lastPayload.current) return;
        lastPayload.current = payload;
        syncWidgetSnapshot(snapshot);
      })
      .catch(() => {
        // A widget that keeps its previous content is better than a crash.
      });

    return () => {
      cancelled = true;
    };
  }, [
    userId,
    carouselOffset,
    data.me,
    data.partner,
    data.space,
    data.presence,
    data.question,
    data.habits,
    data.todayLog,
    data.goodies,
    friends.posts,
  ]);
}
