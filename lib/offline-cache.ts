import AsyncStorage from '@react-native-async-storage/async-storage';

import type { LiveSnapshot } from './backend/repository';

/**
 * The last successfully loaded Space, kept on device.
 *
 * Without this the app cannot open offline at all: `hydrated` only became true
 * after a successful fetch, so with no connection the shell sat on "Loading
 * your shared space" forever. A Space that was loaded once is still worth
 * showing — the questions, 2dos and Goodies in it do not stop being true
 * because the network dropped.
 *
 * Keyed per user so switching accounts on a shared device cannot surface the
 * previous person's Space.
 */

const KEY_PREFIX = 'weship.snapshot.v1.';

/** Signed media URLs inside a cached snapshot expire; images fall back to the on-device media cache. */
export type CachedSnapshot = { snapshot: LiveSnapshot; savedAt: string };

function keyFor(userId: string) {
  return `${KEY_PREFIX}${userId}`;
}

export async function saveSnapshot(userId: string, snapshot: LiveSnapshot): Promise<void> {
  try {
    await AsyncStorage.setItem(
      keyFor(userId),
      JSON.stringify({ snapshot, savedAt: new Date().toISOString() }),
    );
  } catch {
    // A full disk must not break a successful refresh.
  }
}

export async function loadSnapshot(userId: string): Promise<CachedSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedSnapshot;
    return parsed?.snapshot ? parsed : null;
  } catch {
    return null;
  }
}

/** Called on sign-out so a cached Space never outlives the session that made it. */
export async function clearSnapshot(userId?: string): Promise<void> {
  try {
    if (userId) {
      await AsyncStorage.removeItem(keyFor(userId));
      return;
    }
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys.filter((key) => key.startsWith(KEY_PREFIX)));
  } catch {
    // Nothing to clear.
  }
}
