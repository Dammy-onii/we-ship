import { requireOptionalNativeModule } from 'expo';

/**
 * The sound that accompanies an in-app alert.
 *
 * In-app notifications used to appear silently, so anything arriving while the
 * user was reading another part of the screen went unnoticed — the OS only
 * sounds a notification that was delivered to a backgrounded app.
 *
 * Both platforms play a sound the phone already makes, never one shipped with
 * the app. Android asks `RingtoneManager` for the tone the user actually chose,
 * so it also obeys their notification volume, silent mode and Do Not Disturb.
 * iOS gives no way to read that choice, so it plays the system tone the OS uses
 * for an incoming message.
 */
const systemSound = requireOptionalNativeModule<{
  playNotificationSound: () => Promise<boolean>;
  openNotificationSoundSettings?: (channelId: string) => Promise<boolean>;
}>('WeshipSystemSound');

export async function playAlertSound(): Promise<boolean> {
  // Absent on web, and in Expo Go, where the module is not part of the runtime.
  // A silent toast is the correct outcome there; there is nothing to fall back
  // to that would not be a sound invented for the occasion.
  if (!systemSound) return false;
  return systemSound.playNotificationSound().catch(() => false);
}

/** Opens Android's own sound picker for the Weship notification channel. */
export async function openAndroidNotificationSoundSettings(channelId: string): Promise<boolean> {
  if (!systemSound?.openNotificationSoundSettings) return false;
  return systemSound.openNotificationSoundSettings(channelId).catch(() => false);
}
