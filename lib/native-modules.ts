import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Guards for native modules that throw at *module load* in some environments.
 *
 * Several Expo packages (expo-notifications, expo-media-library, …) raise as
 * soon as they are imported when the native side is absent. Because a route
 * file that throws at import produces no default export, one bad top-level
 * import takes down the whole router with a confusing
 * `Cannot read property 'ErrorBoundary' of undefined`.
 *
 * The rule for any such package: import it for **types only**, then load it
 * through `loadNativeModule` at call time and handle `null`.
 */

/** Expo Go ships a fixed native runtime and omits several modules. */
export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/** True where custom native modules exist: a dev build or a store build. */
export const hasCustomNativeRuntime = Platform.OS !== 'web' && !isExpoGo;

/** Why a native capability is unavailable here, for UI messaging. */
export function nativeUnavailableReason(feature: string): string | undefined {
  if (Platform.OS === 'web') return `${feature} is only available in the mobile app.`;
  if (isExpoGo) return `${feature} needs a development build — it is not available in Expo Go.`;
  return undefined;
}

/**
 * Requires a native module only where it can survive being loaded.
 * Returns null instead of throwing so callers can degrade gracefully.
 */
export function loadNativeModule<T>(require: () => T): T | null {
  if (!hasCustomNativeRuntime) return null;
  try {
    return require();
  } catch {
    return null;
  }
}
