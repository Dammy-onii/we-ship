import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Flame, Sprig } from '@/components/art/botanicals';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { showDialog } from '@/components/ui/dialog';
import { useTheme } from '@/hooks/use-theme';
import { userFacingError } from '@/lib/user-facing-error';
import { useBackendStatus, useMe, usePartner, useSpace, useStreak } from '@/lib/store';
import * as repository from '@/lib/backend/repository';
import { dayKeyIn, deviceTimezone } from '@/lib/time';
import { genderLabel } from '@/lib/gender';
import { useSetupStatus } from '@/lib/use-setup-status';

const ROWS = [
  { icon: 'person-outline', label: 'Account', hint: 'Name, profile photo, timezone, and sign out', ready: true, href: '/account' },
  { icon: 'people-outline', label: 'Shared space', hint: '', ready: true, href: '/pairing' },
  { icon: 'grid-outline', label: 'Widget studio', hint: 'Preview and choose active widgets', ready: true, href: '/widgets' },
  { icon: 'link-outline', label: 'Connections', hint: 'Google Calendar and Drive', ready: true, href: '/connections' },
  { icon: 'notifications-outline', label: 'Notifications', hint: 'Enable partner updates on this device', ready: true, href: '/notification-settings' },
  { icon: 'lock-closed-outline', label: 'Privacy', hint: 'What stays just between you', ready: false },
] as const;

export default function ProfileModal() {
  const theme = useTheme();
  const me = useMe();
  const partner = usePartner();
  const streak = useStreak();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const sync = useBackendStatus();
  const space = useSpace();
  const { pending } = useSetupStatus();
  const together = timeTogether(space.anniversary);
  const [editingAnniversary, setEditingAnniversary] = useState(false);
  const anniversaryValue = space.anniversary
    ? new Date(`${space.anniversary}T12:00:00`)
    : new Date();

  return (
    <ScrollView
      style={{ backgroundColor: theme.bg }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        padding: Spacing.lg,
        paddingBottom: insets.bottom + Spacing.lg,
        gap: Spacing.md,
      }}>
      <View style={styles.profileHero}>
        <View style={styles.pair}>
          <Avatar name={me.displayName} seed={me.photoSeed} uri={me.photoUri} ring="you" size={62} />
          <View style={[styles.knot, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            <Sprig size={19} color={theme.primary} />
          </View>
          <Avatar name={partner.displayName} seed={partner.photoSeed} uri={partner.photoUri} ring="them" size={62} />
        </View>
        {space.name ? (
          <Text variant="micro" color="textFaint">{space.name.toUpperCase()}</Text>
        ) : null}
        <Text variant="title">You & {partner.displayName}</Text>
        {genderLabel(me.gender) ? (
          <Text variant="caption" color="textFaint">{genderLabel(me.gender)}</Text>
        ) : null}
        <View style={styles.stats}>
          <Stat value={`${streak.count}`} label="DAY STREAK" icon={<Flame size={15} color={theme.gold} />} />
          <View style={[styles.divider, { backgroundColor: theme.line }]} />
          {together ? <Stat value={together} label="TOGETHER" /> : null}
        </View>
      </View>

      {/* Permissions and connections the user still has to grant. Drive in
          particular is invisible until something fails to upload without it. */}
      {pending.length ? (
        <Pressable
          onPress={() => router.push(pending[0].href)}
          accessibilityRole="button"
          accessibilityLabel={`${pending.length} things still need your attention`}
          style={({ pressed }) => [
            styles.pending,
            { backgroundColor: theme.partnerSoft, borderColor: theme.partner },
            pressed && { opacity: 0.75 },
          ]}>
          <View style={[styles.pendingCount, { backgroundColor: theme.partner }]}>
            <Text variant="captionStrong" style={{ color: theme.onPrimary }}>
              {pending.length}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">
              {pending.length === 1 ? 'One thing needs your attention' : `${pending.length} things need your attention`}
            </Text>
            <Text variant="caption" color="textSoft" numberOfLines={1}>
              {pending.map((step) => step.label).join(' · ')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={theme.textSoft} />
        </Pressable>
      ) : null}

      <View style={styles.anniversary}>
        <Text variant="micro" color="textFaint">ANNIVERSARY</Text>
        <Button
          variant="soft"
          label={space.anniversary ? new Date(`${space.anniversary}T12:00:00`).toLocaleDateString() : 'Set your anniversary'}
          onPress={() => setEditingAnniversary(true)}
          disabled={sync.mode !== 'live' || !sync.paired}
        />
        {editingAnniversary ? (
          <DateTimePicker
            value={anniversaryValue}
            mode="date"
            maximumDate={new Date()}
            onChange={async (_, next) => {
              if (Platform.OS === 'android') setEditingAnniversary(false);
              if (!next) return;
              try {
                await repository.setSpaceAnniversary(dayKeyIn(deviceTimezone(), next));
                await sync.refresh();
                if (Platform.OS === 'ios') setEditingAnniversary(false);
              } catch (error) {
                showDialog('Could not save anniversary', userFacingError(error, 'Please try again.'));
              }
            }}
          />
        ) : null}
      </View>

      <View style={[styles.list, { borderTopColor: theme.line, borderBottomColor: theme.line }]}>
        {ROWS.map((r, i) => (
          <Pressable
            key={r.label}
            disabled={!r.ready || !('href' in r)}
            onPress={() => 'href' in r && router.push(r.href)}
            style={[
              styles.row,
              i < ROWS.length - 1 && {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: theme.line,
              },
            ]}>
            <View style={[styles.rowIcon, { backgroundColor: theme.surfaceAlt }]}>
              <Ionicons name={r.icon} size={17} color={theme.textSoft} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{r.label}</Text>
              <Text variant="caption" color={r.label === 'Shared space' && !sync.paired ? 'partner' : 'textFaint'}>
                {r.label === 'Shared space'
                  ? sync.paired
                    ? `Paired with ${partner.displayName}`
                    : 'Not paired yet — tap to connect'
                  : r.hint}
              </Text>
            </View>
            {pending.some((step) => step.row === r.label) ? (
              <View style={[styles.warnDot, { backgroundColor: theme.partner }]} />
            ) : null}
            {r.ready ? (
              'href' in r ? <Ionicons name="chevron-forward" size={17} color={theme.textFaint} /> : (
                <Text variant="micro" color="primaryDeep">CURRENT</Text>
              )
            ) : (
              <View style={[styles.soon, { backgroundColor: theme.surfaceAlt }]}>
                <Text variant="micro" color="textFaint">COMING SOON</Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      <Text variant="caption" color="textFaint" center style={{ marginTop: Spacing.sm }}>
        {sync.mode === 'live'
          ? sync.error ?? (sync.paired ? 'Private live sync is active' : 'Create or join a shared space to begin syncing')
          : 'Sign in to sync your space across devices'}
      </Text>
    </ScrollView>
  );
}

/** Elapsed time since the pair's anniversary, or undefined when unset. */
function timeTogether(anniversary?: string) {
  if (!anniversary) return undefined;
  const start = new Date(`${anniversary}T00:00:00`);
  if (Number.isNaN(start.getTime())) return undefined;
  const months = Math.max(
    0,
    (new Date().getFullYear() - start.getFullYear()) * 12 + (new Date().getMonth() - start.getMonth()),
  );
  if (months < 1) return 'New';
  if (months < 12) return `${months}mo`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest ? `${years}y ${rest}mo` : `${years}y`;
}

function Stat({ value, label, icon }: { value: string; label: string; icon?: React.ReactNode }) {
  return (
    <View style={{ alignItems: 'center', gap: 3, flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        {icon}
        <Text variant="title" style={{ fontSize: 19 }}>
          {value}
        </Text>
      </View>
      <Text variant="micro" color="textFaint" style={{ fontSize: 9.5 }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pair: { flexDirection: 'row', alignItems: 'center' },
  profileHero: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.lg },
  anniversary: { gap: Spacing.sm },
  knot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: -14,
    zIndex: 1,
  },
  stats: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', marginTop: 4 },
  divider: { width: StyleSheet.hairlineWidth, height: 28 },
  list: { marginHorizontal: -Spacing.lg, paddingHorizontal: Spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soon: { paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: Radius.pill },
  pending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.inset,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pendingCount: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warnDot: { width: 8, height: 8, borderRadius: 4 },
});
