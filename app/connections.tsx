import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { DataState } from '@/components/ui/data-state';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { showDialog } from '@/components/ui/dialog';
import { useTheme } from '@/hooks/use-theme';
import * as drive from '@/lib/backend/drive';
import * as integrations from '@/lib/backend/integrations';
import { useBackendStatus } from '@/lib/store';
import { useGoogleConnection } from '@/lib/use-google-connection';
import { userFacingError } from '@/lib/user-facing-error';

export default function ConnectionsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const sync = useBackendStatus();
  const sharedGoogle = useGoogleConnection();
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
      await sharedGoogle.refresh();
    } catch (error) {
      showDialog('Could not connect Google', userFacingError(error, 'Please try again in a moment.'));
    } finally { setBusy(false); }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await integrations.disconnectProvider('google');
      await load();
      await sharedGoogle.refresh();
    }
    catch (error) { showDialog('Could not disconnect', userFacingError(error, 'Please try again.')); }
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

          {driveGranted ? <DriveStorageMeter /> : null}

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

          {/*
            * Named in plain language. This panel used to print the raw OAuth
            * scope strings — `drive.file · userinfo.email · openid` — which
            * read as debug output left in a shipping screen.
            */}
          <View style={[styles.scopes, { borderColor: theme.line }]}>
            <Text variant="micro" color="textFaint">WHAT WESHIP CAN SEE</Text>
            <ScopeLine granted={calendarGranted} label="Your calendar events" />
            <ScopeLine granted={driveGranted} label="Only the files Weship creates in your Drive" />
            <ScopeLine granted label="Your name, email and profile picture" />
          </View>
          <Button label="Disconnect Google" variant="ghost" disabled={busy} onPress={disconnect} />
        </>
      ) : !loadingConnections && !connectionError ? (
        <Button full loading={busy} label={busy ? 'Opening Google…' : 'Connect Google'} disabled={sync.mode !== 'live'} onPress={connect} />
      ) : null}

      {sync.mode !== 'live' ? <Text variant="caption" color="textFaint">Sign in to connect your Google account.</Text> : null}
      <View style={[styles.privacy, { backgroundColor: theme.surfaceAlt }]}>
        <Ionicons name="shield-checkmark-outline" size={19} color={theme.textSoft} />
        <Text variant="caption" color="textSoft" style={{ flex: 1 }}>Only the calendars you pick are imported, and Weship can only see the files it creates in your Drive.</Text>
      </View>
    </ScrollView>
  );
}

/**
 * How much room is left on the connected Google account.
 *
 * Originals go to the user's own Drive, so their quota is what actually limits
 * sharing — and running out shows up as a failed upload with no explanation
 * unless something says so first.
 */
function DriveStorageMeter() {
  const theme = useTheme();
  const [storage, setStorage] = useState<drive.DriveStorage>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    drive
      .fetchDriveStorage()
      .then((value) => active && setStorage(value))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, []);

  // A failed quota read used to render nothing at all, so the page simply had
  // no Drive information on it and there was no way to tell that apart from a
  // page still loading.
  if (failed) {
    return (
      <View style={[styles.action, { backgroundColor: theme.surfaceAlt }]}>
        <Ionicons name="cloud-offline-outline" size={22} color={theme.textFaint} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">Drive storage</Text>
          <Text variant="caption" color="textFaint">
            Couldn’t read your Drive storage just now. Your files are unaffected.
          </Text>
        </View>
      </View>
    );
  }
  if (!storage) {
    return (
      <View style={[styles.action, { backgroundColor: theme.surfaceAlt }]}>
        <ActivityIndicator color={theme.primary} />
        <Text variant="caption" color="textFaint">Checking your Drive storage…</Text>
      </View>
    );
  }

  // Workspace plans can report no limit at all.
  if (storage.limitBytes === null) {
    return (
      <View style={[styles.action, { backgroundColor: theme.surfaceAlt }]}>
        <Ionicons name="infinite-outline" size={22} color={theme.primaryDeep} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">Drive storage</Text>
          <Text variant="caption" color="textFaint">
            This account has no storage limit.
          </Text>
        </View>
      </View>
    );
  }

  const used = Math.min(1, storage.usageBytes / storage.limitBytes);
  const nearlyFull = used >= 0.9;
  const gettingFull = used >= 0.75;
  const accent = nearlyFull ? theme.partner : gettingFull ? theme.gold : theme.primary;

  return (
    <View style={[styles.action, styles.storage, { backgroundColor: theme.surfaceAlt }]}>
      <View style={styles.storageHead}>
        <Ionicons name="server-outline" size={20} color={accent} />
        <Text variant="bodyStrong" style={{ flex: 1 }}>Drive storage</Text>
        <Text variant="caption" color="textFaint">
          {formatBytes(storage.usageBytes)} of {formatBytes(storage.limitBytes)}
        </Text>
      </View>
      <View style={[styles.storageTrack, { backgroundColor: theme.surfaceSunk }]}>
        <View
          style={[styles.storageFill, { backgroundColor: accent, width: `${Math.max(2, used * 100)}%` }]}
        />
      </View>
      <Text variant="caption" color={nearlyFull ? 'partner' : 'textFaint'}>
        {nearlyFull
          ? `Almost full — ${formatBytes(storage.limitBytes - storage.usageBytes)} left. New photos and videos will start failing to upload.`
          : gettingFull
            ? `${formatBytes(storage.limitBytes - storage.usageBytes)} left.`
            : `${formatBytes(storage.limitBytes - storage.usageBytes)} free for photo and video originals.`}
      </Text>
    </View>
  );
}

/** One capability the connection grants, in words rather than scope strings. */
function ScopeLine({ granted, label }: { granted: boolean; label: string }) {
  const theme = useTheme();
  return (
    <View style={styles.scopeLine}>
      <Ionicons
        name={granted ? 'checkmark-circle' : 'close-circle-outline'}
        size={15}
        color={granted ? theme.success : theme.textFaint}
      />
      <Text variant="caption" color={granted ? 'textSoft' : 'textFaint'} style={{ flex: 1 }}>
        {label}
      </Text>
    </View>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.lg },
  intro: { gap: Spacing.sm },
  storage: { flexDirection: 'column', alignItems: 'stretch', gap: Spacing.sm },
  storageHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  storageTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  storageFill: { height: '100%', borderRadius: 4 },
  provider: { minHeight: 78, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  providerIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  stateDot: { width: 9, height: 9, borderRadius: 5 },
  action: { borderRadius: Radius.inset, padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  scopeLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  scopes: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.inset, padding: Spacing.md, gap: 5 },
  privacy: { borderRadius: Radius.inset, padding: Spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  retryState: { gap: Spacing.sm, alignItems: 'center' },
});
