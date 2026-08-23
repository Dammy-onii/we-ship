import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { goodieToItem, groupByDay, type SpotlightItem } from '@/lib/spotlight-item';
import * as repository from '@/lib/backend/repository';
import { userFacingError } from '@/lib/user-facing-error';
import { useToast } from '@/components/ui/toast';
import { useBackendStatus, useGoodies, useMe, usePartner, YOU_ID } from '@/lib/store';
import { deviceTimezone } from '@/lib/time';
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
  const toast = useToast();
  // `?item=` arrives from the Us widget, which lands on the exact photo rather
  // than the top of the gallery. Remembered once dismissed so closing the
  // viewer does not immediately reopen it on the same param.
  const { item: requestedItem } = useLocalSearchParams<{ item?: string }>();
  const [dismissedRequest, setDismissedRequest] = useState<string>();

  const timezone = deviceTimezone();
  const visible = useMemo(() => {
    const source = filter === 'all' ? goodies : goodies.filter((g) => g.kind === filter);
    return source.map((goodie) => {
      const mine = goodie.authorId === YOU_ID;
      return goodieToItem(goodie, mine ? me : partner, mine);
    });
  }, [goodies, filter, me, partner]);

  const days = groupByDay(visible, timezone);

  const openViewer = (item: SpotlightItem) => {
    const position = visible.findIndex((candidate) => candidate.id === item.id);
    if (position >= 0) setViewerIndex(position);
  };

  const requestIndex =
    requestedItem && requestedItem !== dismissedRequest
      ? visible.findIndex((candidate) => candidate.id === requestedItem)
      : -1;
  const activeIndex = viewerIndex ?? (requestIndex >= 0 ? requestIndex : null);

  const closeViewer = () => {
    setViewerIndex(null);
    if (requestedItem) setDismissedRequest(requestedItem);
  };

  /**
   * Puts this item at the front of the partner's "Us" widget.
   *
   * Only photos and notes: the widget renders a still, and there is no frame to
   * show for a video or a voice note.
   */
  const favourite = async (item: SpotlightItem) => {
    if (item.kind !== 'photo' && item.kind !== 'note') {
      toast.show('Only a photo or a note can be favourited.', { tone: 'info' });
      return;
    }
    try {
      await repository.favouriteGoodieForWidget(item.id);
      toast.show(`Favourited for ${partner.displayName}'s widget.`, { tone: 'success' });
    } catch (error) {
      toast.show(userFacingError(error, 'Could not favourite that.'));
    }
  };

  return (
    <Screen gradient>
      {/* Named for its audience. Two near-identical galleries called
          "Spotlight" and "Friends" gave no clue which one a post would go to. */}
      <AppHeader title="Spotlight" subtitle={`Just you and ${partner.displayName}`} />

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
            {days.map((day) => (
              <SpotlightSection
                key={day.key}
                title={day.title}
                count={day.items.length}
                items={day.items}
                onOpen={openViewer}
                onLongPress={favourite}
              />
            ))}
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

      {activeIndex !== null ? (
        <MediaViewer items={visible} startIndex={activeIndex} onClose={closeViewer} />
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
