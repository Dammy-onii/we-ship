import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { userFacingError } from '@/lib/user-facing-error';
import { useAuth } from '@/lib/auth';
import {
  disablePushNotifications,
  enablePushNotifications,
  pushNotificationsEnabled,
  pushSupported,
  pushUnavailableReason,
} from '@/lib/push';

export default function NotificationSettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [checking, setChecking] = useState(Boolean(auth.user && pushSupported));

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
      Alert.alert('Notifications enabled', 'Partner updates can now reach this device.');
    } catch (error) {
      Alert.alert('Could not enable notifications', userFacingError(error, 'Try again on a physical device.'));
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
      Alert.alert('Could not update notifications', userFacingError(error, 'Please try again.'));
    } finally {
      setBusy(false);
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
});
