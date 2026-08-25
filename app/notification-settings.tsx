import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { showDialog } from '@/components/ui/dialog';
import { useTheme } from '@/hooks/use-theme';
import { userFacingError } from '@/lib/user-facing-error';
import { openAndroidNotificationSoundSettings, playAlertSound } from '@/lib/alert-sound';
import { useAuth } from '@/lib/auth';
import {
  disablePushNotifications,
  enablePushNotifications,
  pushNotificationsEnabled,
  pushSupported,
  pushUnavailableReason,
  PUSH_CHANNEL,
  scheduleTestNotification,
} from '@/lib/push';

export default function NotificationSettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [checking, setChecking] = useState(Boolean(auth.user && pushSupported));
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    let active = true;
    if (!auth.user || !pushSupported) return;
    pushNotificationsEnabled(auth.user.id)
      .then((value) => { if (active) setEnabled(value); })
      .catch(() => { if (active) setEnabled(false); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [auth.user]);

  const enable = async () => {
    if (!auth.user) return;
    setBusy(true);
    try {
      await enablePushNotifications(auth.user.id);
      setEnabled(true);
      showDialog('Notifications enabled', 'Partner updates can now reach this device.');
    } catch (error) {
      showDialog('Could not enable notifications', userFacingError(error, 'This device could not be registered for push.'));
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (!auth.user) return;
    setBusy(true);
    try {
      await disablePushNotifications(auth.user.id);
      setEnabled(false);
    } catch (error) {
      showDialog('Could not update notifications', userFacingError(error, 'Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const testInAppSound = async () => {
    const played = await playAlertSound();
    if (!played) {
      showDialog(
        'No in-app sound played',
        'Check that the phone is not silent and that notification volume is up. A custom development or release build is required.',
      );
    }
  };

  const testNotification = async () => {
    setTesting(true);
    try {
      await scheduleTestNotification();
      showDialog('Test scheduled', 'A Weship notification should appear and sound in two seconds.');
    } catch (error) {
      showDialog('Could not test notifications', userFacingError(error, 'Please try again.'));
    } finally {
      setTesting(false);
    }
  };

  const chooseAndroidSound = async () => {
    const opened = await openAndroidNotificationSoundSettings(PUSH_CHANNEL);
    if (!opened) {
      showDialog(
        'Open Android notification settings',
        'Go to Settings › Apps › Weship › Notifications › Weship updates › Sound.',
      );
    }
  };

  return (
    <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}>
      <View style={[styles.hero, { backgroundColor: theme.surfaceAlt }]}>
        <Ionicons name="notifications-outline" size={30} color={theme.primaryDeep} />
        <Text variant="title">Partner updates</Text>
        <Text variant="body" color="textSoft" center>Receive 2do changes, Goodies, new memories, calendar updates, streak activity, and game turns.</Text>
      </View>
      {pushUnavailableReason ? (
        <View style={[styles.unavailable, { backgroundColor: theme.surfaceAlt, borderColor: theme.line }]}>
          <Ionicons name="information-circle-outline" size={17} color={theme.textSoft} />
          <Text variant="caption" color="textSoft" style={{ flex: 1 }}>{pushUnavailableReason}</Text>
        </View>
      ) : null}
      <Button full label={checking ? 'Checking…' : busy ? 'Updating…' : enabled ? 'Notifications enabled' : 'Enable notifications'} disabled={checking || busy || enabled || !auth.configured || !pushSupported} onPress={enable} />
      {enabled ? (
        <View style={styles.tests}>
          <Button full variant="soft" label="Test in-app sound" disabled={testing} onPress={testInAppSound} />
          <Button full variant="soft" label={testing ? 'Scheduling…' : 'Test system notification'} disabled={testing} onPress={testNotification} />
          {Platform.OS === 'android' ? (
            <Button full variant="soft" label="Choose Android notification sound" disabled={testing} onPress={chooseAndroidSound} />
          ) : null}
        </View>
      ) : null}
      {enabled ? <Button full variant="soft" label="Disable on this device" disabled={busy} onPress={disable} /> : null}
      <Text variant="caption" color="textFaint">Weship asks the phone only when you press Enable. Each physical device stores its own revocable Expo push token.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  unavailable: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.inset,
    borderWidth: StyleSheet.hairlineWidth,
  },
  content: { padding: Spacing.lg, gap: Spacing.lg },
  hero: { borderRadius: Radius.tile, padding: Spacing.xl, alignItems: 'center', gap: Spacing.md },
  tests: { gap: Spacing.sm },
});
