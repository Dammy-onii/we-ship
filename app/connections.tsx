import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { DataState } from '@/components/ui/data-state';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import * as integrations from '@/lib/backend/integrations';
import { useBackendStatus } from '@/lib/store';
import { userFacingError } from '@/lib/user-facing-error';

export default function ConnectionsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const sync = useBackendStatus();
  const [connections, setConnections] = useState<integrations.ProviderConnection[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadingConnections, setLoadingConnections] = useState(sync.mode === 'live');
  const [connectionError, setConnectionError] = useState<string>();
  const google = connections.find((item) => item.provider === 'google');
  // Google only grants what its consent screen is configured to offer, so a
  // connection can succeed for Calendar while silently omitting Drive.
  const driveGranted = Boolean(google?.scopes?.some((scope) => scope.includes('drive')));
  const calendarGranted = Boolean(google?.scopes?.some((scope) => scope.includes('calendar')));

  const load = async () => {
    if (sync.mode !== 'live') return;
    setLoadingConnections(true);
    try {
      setConnections(await integrations.listConnections());
      setConnectionError(undefined);
    } catch (error) {
      setConnectionError(userFacingError(error, 'Could not load connections.'));
    } finally {
      setLoadingConnections(false);
    }
  };
  useEffect(() => {
    let active = true;
    if (sync.mode === 'live') {
      integrations.listConnections()
        .then((items) => { if (active) { setConnections(items); setConnectionError(undefined); } })
        .catch((error) => { if (active) setConnectionError(userFacingError(error, 'Could not load connections.')); })
        .finally(() => { if (active) setLoadingConnections(false); });
    }
    return () => { active = false; };
  }, [sync.mode]);

  const connect = async () => {
    setBusy(true);
    try {
      await integrations.connectGoogle();
      await load();
    } catch (error) {
      Alert.alert('Could not connect Google', userFacingError(error, 'Please try again in a moment.'));
    } finally { setBusy(false); }
  };

  const disconnect = async () => {
    setBusy(true);
    try { await integrations.disconnectProvider('google'); await load(); }
    catch (error) { Alert.alert('Could not disconnect', userFacingError(error, 'Please try again.')); }
    finally { setBusy(false); }
  };

  return (
    <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}>
      <View style={styles.intro}>
        <Text variant="micro" color="textFaint">CONNECTED SERVICES</Text>
        <Text variant="display">Your accounts stay yours</Text>
        <Text variant="body" color="textSoft">Each partner connects their own Google account. Weship stores the connection server-side and never places refresh tokens in the app.</Text>
      </View>

      {loadingConnections ? <DataState compact loading title="Checking your connections" /> : null}
      {connectionError ? (
        <View style={styles.retryState}>
          <DataState compact icon="cloud-offline-outline" title="Connections unavailable" detail={connectionError} />
          <Button label="Try again" variant="soft" disabled={loadingConnections} onPress={load} />
        </View>
      ) : null}

      {!loadingConnections ? <View style={[styles.provider, { borderTopColor: theme.line, borderBottomColor: theme.line }]}>
        <View style={[styles.providerIcon, { backgroundColor: theme.surfaceAlt }]}><Ionicons name="logo-google" size={22} color={theme.text} /></View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text variant="bodyStrong">Google</Text>
          <Text variant="caption" color="textFaint">{google ? `${google.account_label ?? 'Connected account'} · ${google.status}` : 'Calendar plus Drive-owned photo and video originals'}</Text>
        </View>
        <View style={[styles.stateDot, { backgroundColor: google?.status === 'active' ? theme.primary : theme.lineStrong }]} />
      </View> : null}

      {!loadingConnections && !connectionError && google ? (
        <>
          <Pressable onPress={() => router.push('/calendar')} style={[styles.action, { backgroundColor: theme.surfaceAlt }]}>
            <Ionicons name="calendar-outline" size={22} color={theme.primaryDeep} />
            <View style={{ flex: 1 }}><Text variant="bodyStrong">Calendar</Text><Text variant="caption" color="textFaint">Choose calendars, import selected events, or create one.</Text></View>
            <Ionicons name="chevron-forward" size={18} color={theme.textFaint} />
          </Pressable>
          <View style={[styles.action, { backgroundColor: theme.surfaceAlt }]}>
            <Ionicons
              name={driveGranted ? 'cloud-done-outline' : 'cloud-offline-outline'}
              size={22}
              color={driveGranted ? theme.primaryDeep : theme.partner}
            />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">Drive-primary media</Text>
              <Text variant="caption" color={driveGranted ? 'textFaint' : 'partner'}>
                {driveGranted
                  ? 'Granted. New photo/video originals use your Drive quota; Weship keeps only small private previews.'
                  : 'Not granted. Google connected Calendar but withheld Drive access, so originals cannot be uploaded.'}
              </Text>
            </View>
          </View>

          {!driveGranted ? (
            <View style={[styles.privacy, { backgroundColor: theme.partnerSoft }]}>
              <Ionicons name="alert-circle-outline" size={19} color={theme.partner} />
              <View style={{ flex: 1, gap: Spacing.sm }}>
                <Text variant="caption" color="textSoft">
                  Google connected your calendar but not your Drive, so photos and videos can’t be saved
                  yet. Reconnect and allow Drive access when Google asks.
                </Text>
                <Button label="Reconnect Google" variant="soft" disabled={busy} onPress={connect} />
              </View>
            </View>
          ) : null}

          <View style={[styles.scopes, { borderColor: theme.line }]}>
            <Text variant="micro" color="textFaint">GRANTED ACCESS</Text>
            <Text variant="caption" color="textSoft">
              Calendar {calendarGranted ? '✓' : '—'}   ·   Drive {driveGranted ? '✓' : '—'}
            </Text>
            {google?.scopes?.length ? (
              <Text variant="micro" color="textFaint">
                {google.scopes.map((scope) => scope.split('/').pop()).join(' · ')}
              </Text>
            ) : null}
          </View>
          <Button label="Disconnect Google" variant="ghost" disabled={busy} onPress={disconnect} />
        </>
      ) : !loadingConnections && !connectionError ? (
        <Button full label={busy ? 'Opening Google…' : 'Connect Google'} disabled={busy || sync.mode !== 'live'} onPress={connect} />
      ) : null}

      {sync.mode !== 'live' ? <Text variant="caption" color="textFaint">Sign in to connect your Google account.</Text> : null}
      <View style={[styles.privacy, { backgroundColor: theme.surfaceAlt }]}>
        <Ionicons name="shield-checkmark-outline" size={19} color={theme.textSoft} />
        <Text variant="caption" color="textSoft" style={{ flex: 1 }}>Only the calendars you pick are imported, and Weship can only see the files it creates in your Drive.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.lg },
  intro: { gap: Spacing.sm },
  provider: { minHeight: 78, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  providerIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  stateDot: { width: 9, height: 9, borderRadius: 5 },
  action: { borderRadius: Radius.inset, padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  scopes: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.inset, padding: Spacing.md, gap: 5 },
  privacy: { borderRadius: Radius.inset, padding: Spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  retryState: { gap: Spacing.sm, alignItems: 'center' },
});
