import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader, HeaderIconButton } from '@/components/app-header';
import { FriendComposer } from '@/components/friend-composer';
import { MediaViewer } from '@/components/media-viewer';
import { SpotlightSection } from '@/components/spotlight-grid';
import { Button } from '@/components/ui/button';
import { DataState } from '@/components/ui/data-state';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { Radius, Shadow, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useFriends } from '@/lib/friends';
import { friendPostToItem, groupByDay, type SpotlightItem } from '@/lib/spotlight-item';
import { deviceTimezone } from '@/lib/time';
import type { FriendPostKind } from '@/lib/types';

type Filter = 'all' | FriendPostKind;

const FILTERS: { key: Filter; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'all', label: 'All', icon: 'sparkles-outline' },
  { key: 'photo', label: 'Photos', icon: 'image-outline' },
  { key: 'video', label: 'Videos', icon: 'videocam-outline' },
  { key: 'voice', label: 'Voice', icon: 'mic-outline' },
  { key: 'note', label: 'Notes', icon: 'chatbubble-outline' },
];

export default function FriendSpotlightScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { enabled, initialLoading, posts, friends, error, refresh } = useFriends();
  const [filter, setFilter] = useState<Filter>('all');
  // `?person=` narrows the board to one friend, so "See their posts" in the
  // friends list has somewhere real to go.
  const { person } = useLocalSearchParams<{ person?: string }>();
  const focused = friends.find((candidate) => candidate.id === person);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [composing, setComposing] = useState(false);

  const timezone = deviceTimezone();
  const visible = useMemo(() => {
    const byPerson = person ? posts.filter((post) => post.author.id === person) : posts;
    const source = filter === 'all' ? byPerson : byPerson.filter((post) => post.kind === filter);
    return source.map(friendPostToItem);
  }, [posts, filter, person]);

  const days = groupByDay(visible, timezone);

  const openViewer = (item: SpotlightItem) => {
    const position = visible.findIndex((candidate) => candidate.id === item.id);
    if (position >= 0) setViewerIndex(position);
  };

  const composeButton = enabled ? (
    <Pressable
      onPress={() => setComposing(true)}
      accessibilityRole="button"
      accessibilityLabel="Post to friends"
      style={({ pressed }) => [
        styles.fab,
        { backgroundColor: theme.primary, bottom: Math.max(insets.bottom, 16) + 88 },
        Shadow.lifted,
        pressed && { opacity: 0.9, transform: [{ scale: 0.96 }] },
      ]}>
      <Ionicons name="add" size={28} color={theme.onPrimary} />
    </Pressable>
  ) : null;

  return (
    <Screen gradient overlay={composeButton}>
      <AppHeader
        title={focused ? focused.displayName : 'Friends Spotlight'}
        subtitle={
          focused
            ? 'Everything they have posted'
            : friends.length
              ? `Shared with your ${friends.length} friend${friends.length === 1 ? '' : 's'}`
              : 'Shared with all your friends'
        }
        action={
          enabled ? (
            <HeaderIconButton
              icon="person-add-outline"
              label="Find and add friends"
              onPress={() => router.push('/friends')}
            />
          ) : null
        }
      />

      <View style={styles.body}>
        {!enabled ? (
          <DataState
            icon="people-outline"
            title="Friends need an account"
            detail="Sign in to connect with people on Weship and see what they post."
          />
        ) : initialLoading ? (
          <DataState loading title="Loading the board" detail="Gathering what your friends posted." />
        ) : (
          <>
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
                    <Ionicons
                      name={item.icon}
                      size={14}
                      color={active ? theme.onPrimary : theme.textSoft}
                    />
                    <Text
                      variant="captionStrong"
                      style={{ color: active ? theme.onPrimary : theme.textSoft }}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {error ? (
              <Pressable
                onPress={() => refresh()}
                style={[styles.banner, { backgroundColor: theme.surfaceAlt, borderColor: theme.line }]}>
                <Ionicons name="cloud-offline-outline" size={17} color={theme.textSoft} />
                <Text variant="caption" color="textSoft" style={{ flex: 1 }}>
                  {error}
                </Text>
                <Text variant="captionStrong" color="primary">
                  Retry
                </Text>
              </Pressable>
            ) : null}

            {!friends.length ? (
              <View style={styles.empty}>
                <DataState
                  icon="person-add-outline"
                  title="No friends yet"
                  detail="Find people by their username, and their posts will show up here."
                />
                <Button label="Find people" variant="soft" onPress={() => router.push('/friends')} />
              </View>
            ) : !visible.length ? (
              <DataState
                icon="sparkles-outline"
                title={filter === 'all' ? 'Nothing on the board yet' : 'Nothing here yet'}
                detail="Post the first one with the button below."
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
                  />
                ))}
              </>
            )}
          </>
        )}
      </View>

      <FriendComposer visible={composing} onClose={() => setComposing(false)} />

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
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.inset,
    borderWidth: StyleSheet.hairlineWidth,
  },
  empty: { gap: Spacing.sm, alignItems: 'center' },
  fab: {
    position: 'absolute',
    alignSelf: 'center',
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
