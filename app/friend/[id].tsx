import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MediaViewer } from '@/components/media-viewer';
import { SpotlightSection } from '@/components/spotlight-grid';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DataState } from '@/components/ui/data-state';
import { showDialog } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fetchFriendProfile, type FriendProfile } from '@/lib/backend/friends';
import { useFriends } from '@/lib/friends';
import { genderLabel } from '@/lib/gender';
import { friendPostToItem, groupByDay, type SpotlightItem } from '@/lib/spotlight-item';
import { deviceTimezone, relativeDay } from '@/lib/time';
import { userFacingError } from '@/lib/user-facing-error';

/**
 * One friend, in full.
 *
 * Replaces the native action sheet that used to open from the friend row. That
 * sheet was a system dialog with a name, a handle, and two verbs — nothing
 * about the person, and "Remove friend" sitting directly under the tap that had
 * only meant "who is this?".
 */
export default function FriendProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { friends, posts, unfriend, react } = useFriends();

  // The friend list already holds name, handle and avatar, so the page paints
  // immediately and the richer detail fills in behind it.
  const known = friends.find((candidate) => candidate.id === id);
  const [profile, setProfile] = useState<FriendProfile>();
  const [loadFailed, setLoadFailed] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    let active = true;
    if (!id) return;
    fetchFriendProfile(id)
      .then((value) => {
        if (!active) return;
        if (value) setProfile(value);
        else setLoadFailed(true);
      })
      .catch(() => active && setLoadFailed(true));
    return () => {
      active = false;
    };
  }, [id]);

  const timezone = deviceTimezone();
  const theirs = useMemo(
    () => posts.filter((post) => post.author.id === id).map(friendPostToItem),
    [posts, id],
  );
  const days = groupByDay(theirs, timezone);

  const openViewer = (item: SpotlightItem) => {
    const position = theirs.findIndex((candidate) => candidate.id === item.id);
    if (position >= 0) setViewerIndex(position);
  };

  const person = profile ?? known;

  if (!person) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.bg }]}>
        <DataState
          icon={loadFailed ? 'alert-circle-outline' : undefined}
          loading={!loadFailed}
          title={loadFailed ? 'Profile unavailable' : 'Loading'}
          detail={
            loadFailed ? 'You may no longer be connected with this person.' : undefined
          }
        />
      </View>
    );
  }

  const confirmRemove = () => {
    showDialog(
      `Remove ${person.displayName}?`,
      'You will stop seeing each other’s friend board posts. You can send a new request later.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Remove friend',
          style: 'destructive',
          onPress: () => {
            setRemoving(true);
            unfriend(person.id)
              .then(() => router.back())
              .catch((cause: unknown) => {
                setRemoving(false);
                showDialog('Could not remove', userFacingError(cause, 'Please try again.'));
              });
          },
        },
      ],
    );
  };

  const gender = genderLabel(profile?.gender);

  return (
    <>
      <ScrollView
        style={{ backgroundColor: theme.bg }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}>
        <View style={styles.hero}>
          <Avatar name={person.displayName} uri={person.photoUri} size={84} />
          <View style={styles.heroCopy}>
            <Text variant="display" center>
              {person.displayName}
            </Text>
            {person.username ? (
              <Text variant="body" color="textFaint" center>
                @{person.username}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={[styles.facts, { borderTopColor: theme.line, borderBottomColor: theme.line }]}>
          <Fact
            icon="heart-outline"
            label="Relationship"
            /* Whether they are paired, never with whom — that is their space. */
            value={
              profile
                ? profile.paired
                  ? 'In a shared space'
                  : 'Not paired yet'
                : '—'
            }
          />
          {gender ? <Fact icon="person-outline" label="Gender" value={gender} /> : null}
          <Fact
            icon="people-outline"
            label="Friends since"
            value={profile ? relativeDay(profile.friendsSince.slice(0, 10)) : '—'}
          />
          <Fact
            icon="images-outline"
            label="Posts on your board"
            value={String(theirs.length)}
            last
          />
        </View>

        <View style={styles.postsHead}>
          <Text variant="micro" color="textFaint">
            THEIR POSTS
          </Text>
        </View>
        {!theirs.length ? (
          <DataState
            compact
            icon="sparkles-outline"
            title="Nothing here yet"
            detail={`${person.displayName} hasn’t posted to the friend board.`}
          />
        ) : (
          days.map((day) => (
            <SpotlightSection
              key={day.key}
              title={day.title}
              count={day.items.length}
              items={day.items}
              onOpen={openViewer}
            />
          ))
        )}

        <View style={styles.actions}>
          {/*
            No "see them on the friend board" link. This page already lists
            everything they have posted, so it sent you to a filtered copy of
            the list you were looking at.
          */}
          <Button
            full
            variant="ghost"
            loading={removing}
            disabled={removing}
            label="Remove friend"
            onPress={confirmRemove}
          />
        </View>
      </ScrollView>

      {viewerIndex !== null ? (
        <MediaViewer
          items={theirs}
          startIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onReact={react}
        />
      ) : null}
    </>
  );
}

function Fact({
  icon,
  label,
  value,
  last = false,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  last?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.fact,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.line },
      ]}>
      <View style={[styles.factIcon, { backgroundColor: theme.surfaceAlt }]}>
        <Ionicons name={icon} size={17} color={theme.textSoft} />
      </View>
      <Text variant="body" color="textSoft" style={{ flex: 1 }}>
        {label}
      </Text>
      <Text variant="bodyStrong">{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center' },
  content: { padding: Spacing.lg, gap: Spacing.lg },
  hero: { alignItems: 'center', gap: Spacing.md, paddingTop: Spacing.sm },
  heroCopy: { gap: 2, alignItems: 'center' },
  facts: {
    marginHorizontal: -Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fact: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  factIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postsHead: { gap: Spacing.xs },
  actions: { gap: Spacing.sm, paddingTop: Spacing.sm },
});
