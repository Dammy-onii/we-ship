import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Whether this device has been walked through the introduction.
 *
 * Stored per device rather than per account: onboarding explains what Weship
 * *is*, which someone only needs once, and they see it before they have an
 * account to attach it to.
 */

const KEY = 'weship.onboarding.seen.v1';

export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === 'true';
  } catch {
    // If we cannot tell, showing it again is the kinder failure.
    return false;
  }
}

export async function markOnboardingSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, 'true');
  } catch {
    // Losing the flag only costs the user one extra swipe next launch.
  }
}

/** Exposed for a "replay the intro" control and for testing. */
export async function resetOnboarding(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
