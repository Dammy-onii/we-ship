import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { MediaViewer } from '@/components/media-viewer';
import { SpotlightSection } from '@/components/spotlight-grid';
import { DataState } from '@/components/ui/data-state';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { Radius, Shadow, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { goodieToItem, type SpotlightItem } from '@/lib/spotlight-item';
import { useBackendStatus, useGoodies, useMe, usePartner, YOU_ID } from '@/lib/store';
import { dayKeyForInstant, dayKeyIn, deviceTimezone } from '@/lib/time';
import type { GoodieKind } from '@/lib/types';

type Filter = 'all' | GoodieKind;

const FILTERS: { key: Filter; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'all', label: 'All', icon: 'sparkles-outline' },
  { key: 'photo', label: 'Photos', icon: 'image-outline' },
  { key: 'video', label: 'Videos', icon: 'videocam-outline' },
  { key: 'voice', label: 'Voice', icon: 'mic-outline' },
  { key: 'note', label: 'Notes', icon: 'chatbubble-outline' },
];

export default function SpotlightScreen() {
  const theme = useTheme();
  const router = useRouter();
  const sync = useBackendStatus();
  const { goodies } = useGoodies();
  const me = useMe();
  const partner = usePartner();
  const [filter, setFilter] = useState<Filter>('all');
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const timezone = deviceTimezone();
  const today = dayKeyIn(timezone);
  const visible = useMemo(() => {
    const source = filter === 'all' ? goodies : goodies.filter((g) => g.kind === filter);
    return source.map((goodie) => {
      const mine = goodie.authorId === YOU_ID;
      return goodieToItem(goodie, mine ? me : partner, mine);
    });
  }, [goodies, filter, me, partner]);

  const todays = visible.filter((item) => dayKeyForInstant(item.createdAt, timezone) === today);
  const earlier = visible.filter((item) => dayKeyForInstant(item.createdAt, timezone) !== today);

  const openViewer = (item: SpotlightItem) => {
    const position = visible.findIndex((candidate) => candidate.id === item.id);
    if (position >= 0) setViewerIndex(position);
  };

  return (
    <Screen gradient>
      <AppHeader title="Spotlight" subtitle={`What ${partner.displayName} shared`} />

      <View style={styles.body}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}>
          {FILTERS.map((item) => {
            const active = filter === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setFilter(item.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[
                  styles.filter,
                  {
                    backgroundColor: active ? theme.primary : theme.surfaceAlt,
                    borderColor: active ? theme.primary : theme.line,
                  },
                ]}>
                <Ionicons name={item.icon} size={14} color={active ? theme.onPrimary : theme.textSoft} />
                <Text variant="captionStrong" style={{ color: active ? theme.onPrimary : theme.textSoft }}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {sync.loading && !goodies.length ? (
          <DataState compact loading title="Gathering today’s Goodies" />
        ) : !visible.length ? (
          <DataState
            icon="sparkles-outline"
            title={filter === 'all' ? 'Nothing shared yet' : 'Nothing here yet'}
            detail={`Send the first ${filter === 'all' ? 'Goodie' : filter} and it will appear here for both of you.`}
          />
        ) : (
          <>
            {todays.length ? (
              <SpotlightSection title="Today" count={todays.length} items={todays} onOpen={openViewer} />
            ) : null}
            {earlier.length ? (
              <SpotlightSection title="Earlier" count={earlier.length} items={earlier} onOpen={openViewer} />
            ) : null}
          </>
        )}

        <Pressable
          onPress={() => router.push('/goodies')}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.compose,
            { backgroundColor: theme.primary },
            Shadow.soft,
            pressed && { opacity: 0.9 },
          ]}>
          <Ionicons name="add" size={19} color={theme.onPrimary} />
          <Text variant="bodyStrong" style={{ color: theme.onPrimary }}>
            Send something
          </Text>
        </Pressable>
      </View>

      {viewerIndex !== null ? (
        <MediaViewer items={visible} startIndex={viewerIndex} onClose={() => setViewerIndex(null)} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xl },
  filters: { gap: Spacing.sm, paddingRight: Spacing.lg },
  filter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  compose: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 15,
    borderRadius: Radius.pill,
  },
});
