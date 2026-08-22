import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

// Type-only import: erased at compile time, so it never loads the native module.
import type * as NotificationsModule from 'expo-notifications';

import { backendConfig } from './backend/config';
import { hasCustomNativeRuntime, loadNativeModule, nativeUnavailableReason } from './native-modules';
import { requireSupabase } from './backend/supabase';
import { registerBackgroundWidgetRefresh } from './background-widget-refresh';

/**
 * Where remote push can actually run.
 *
 * Two environments cannot host it, and both fail at *module load* rather than
 * at call time — so `expo-notifications` must never be imported at the top
 * level or it takes the whole route tree down with it:
 *   - web, which has no implementation at all
 *   - Expo Go, which dropped Android remote push in SDK 53
 * A development or release build supports it normally.
 */
export const pushSupported = hasCustomNativeRuntime;

/** Reason push is unavailable here, for surfacing in the UI. */
export const pushUnavailableReason = nativeUnavailableReason('Push notifications');

let cached: typeof NotificationsModule | null = null;
let handlerInstalled = false;
const PUSH_CHANNEL = 'weship-updates-v3';
const FRIEND_REQUEST_CATEGORY = 'friend_request';

/** Loads expo-notifications only where it can survive being loaded. */
function notifications(): typeof NotificationsModule | null {
  if (!cached) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = loadNativeModule<typeof NotificationsModule>(() => require('expo-notifications'));
    if (!cached) return null;
  }
  if (!handlerInstalled && cached) {
    handlerInstalled = true;
    cached.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }
  return cached;
}

function projectId() {
  return Constants.easConfig?.projectId || backendConfig.easProjectId;
}

async function configureNotificationSurfaces(Notifications: typeof NotificationsModule) {
  await registerBackgroundWidgetRefresh(Notifications);
  if (Platform.OS === 'android') {
    // A channel's sound cannot be changed after creation. Omitting `sound`
    // selects Android's default notification sound; passing the string
    // "default" is interpreted as a custom resource name by SDK 57 and emits
    // a technical error toast. The v3 id also migrates installs that created
    // the v2 channel with that invalid resource.
    await Notifications.setNotificationChannelAsync(PUSH_CHANNEL, {
      name: 'Weship updates',
      description: 'Partner, friend, Goodie, task, memory, calendar, and game updates.',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 180, 120, 180],
      lightColor: '#77736E',
    });
  }
  await Notifications.setNotificationCategoryAsync(FRIEND_REQUEST_CATEGORY, [
    { identifier: 'accept', buttonTitle: 'Accept' },
    { identifier: 'decline', buttonTitle: 'Decline', options: { isDestructive: true } },
  ]);
}

async function currentDeviceToken(requestPermission: boolean): Promise<string | null> {
  const Notifications = notifications();
  if (!Notifications || !Device.isDevice) return null;
  const id = projectId();
  if (!id) return null;
  const existing = await Notifications.getPermissionsAsync();
  const permission =
    existing.status === 'granted'
      ? existing
      : requestPermission
        ? await Notifications.requestPermissionsAsync()
        : existing;
  if (permission.status !== 'granted') return null;
  return (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
}

export async function enablePushNotifications(userId: string) {
  const Notifications = notifications();
  if (!Notifications) throw new Error(pushUnavailableReason ?? 'Push notifications are unavailable here.');
  if (!Device.isDevice) throw new Error('Push notifications must be enabled on a physical device.');
  if (!projectId()) throw new Error('This build is missing its notification project ID.');
  await configureNotificationSurfaces(Notifications);
  const token = await currentDeviceToken(true);
  if (!token) throw new Error('Notification permission was not granted.');
  const { error } = await requireSupabase().from('push_tokens').upsert(
    {
      user_id: userId,
      expo_push_token: token,
      platform: Platform.OS,
      device_name: Device.deviceName ?? null,
      app_version: Constants.expoConfig?.version ?? null,
      enabled: true,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'expo_push_token' },
  );
  if (error) throw new Error(error.message);
  return token;
}

export async function disablePushNotifications(userId: string) {
  const token = await currentDeviceToken(false);
  if (!token) throw new Error('This device does not have an active notification token.');
  const { error } = await requireSupabase()
    .from('push_tokens')
    .update({ enabled: false })
    .eq('user_id', userId)
    .eq('expo_push_token', token);
  if (error) throw new Error(error.message);
}

/** Reads the persisted row for this physical device without prompting. */
export async function pushNotificationsEnabled(userId: string): Promise<boolean> {
  const token = await currentDeviceToken(false);
  if (!token) return false;
  const { data, error } = await requireSupabase()
    .from('push_tokens')
    .select('enabled')
    .eq('user_id', userId)
    .eq('expo_push_token', token)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.enabled === true;
}

function routeFromNotification(notification: NotificationsModule.Notification) {
  const url = notification.request.content.data?.url;
  if (typeof url === 'string' && url.startsWith('/')) router.push(url as never);
  else router.push('/notifications');
}

async function handleNotificationResponse(response: NotificationsModule.NotificationResponse) {
  const data = response.notification.request.content.data;
  const requestId = typeof data?.requestId === 'string' ? data.requestId : undefined;
  if (requestId && response.actionIdentifier === 'accept') {
    const { error } = await requireSupabase().rpc('accept_friend_request', { request_id: requestId });
    if (error) throw new Error(error.message);
    router.push('/friends');
    return;
  }
  if (requestId && response.actionIdentifier === 'decline') {
    const { error } = await requireSupabase().from('friendships').delete().eq('id', requestId);
    if (error) throw new Error(error.message);
    router.push('/friends');
    return;
  }
  routeFromNotification(response.notification);
}

/** The launching notification should be consumed once, not on every remount. */
let handledLaunchNotification = false;

export function usePushNotificationRouting() {
  useEffect(() => {
    const Notifications = notifications();
    if (!Notifications) return;
    configureNotificationSurfaces(Notifications).catch(() => {});
    if (!handledLaunchNotification) {
      handledLaunchNotification = true;
      const lastResponse = Notifications.getLastNotificationResponse();
      if (lastResponse?.notification) {
        handleNotificationResponse(lastResponse).catch(() => routeFromNotification(lastResponse.notification));
        Notifications.clearLastNotificationResponse();
      }
    }
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationResponse(response).catch(() => routeFromNotification(response.notification));
    });
    return () => subscription.remove();
  }, []);
}
