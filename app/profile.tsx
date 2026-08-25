import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MediaViewer } from '@/components/media-viewer';
import { REACTIONS } from '@/components/reaction-bar';
import { SpotlightSection } from '@/components/spotlight-grid';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DataState } from '@/components/ui/data-state';
import { showDialog } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { Font, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { fetchMyReactionTotals } from '@/lib/backend/friends';
import * as repository from '@/lib/backend/repository';
import { useFriends } from '@/lib/friends';
import { friendPostToItem, groupByDay, type SpotlightItem } from '@/lib/spotlight-item';
import { useMe } from '@/lib/store';
import { deviceTimezone } from '@/lib/time';
import type { ReactionKind } from '@/lib/types';
import { userFacingError } from '@/lib/user-facing-error';

const BIO_LIMIT = 200;

/**
 * Your own page — the public one, seen the way a friend sees it, plus the parts
 * only you can see.
 *
 * The stats here are about *you*, not your partner: your posts, and the
 * reactions they have drawn. Reaction totals are shown to nobody else. The
 * friend-profile page deliberately has no equivalent, so one person can never
 * read another's running tally.
 */
export default function ProfileScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const me = useMe();
  const auth = useAuth();
  const { posts } = useFriends();

  const timezone = deviceTimezone();
  const mine = useMemo(
    () => posts.filter((post) => post.mine).map(friendPostToItem),
    [posts],
  );
  const days = groupByDay(mine, timezone);

  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [totals, setTotals] = useState<Record<ReactionKind, number>>();

  useEffect(() => {
    let active = true;
    fetchMyReactionTotals()
      .then((value) => active && setTotals(value))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [posts.length]);

  const totalReactions = totals
    ? Object.values(totals).reduce((sum, n) => sum + n, 0)
    : undefined;

  // Bio editing, in place. `savedBio` holds the just-saved value optimistically
  // — the store's next refresh replaces it with the persisted one — so the hook
  // result is never mutated (the compiler forbids that) and the card does not
  // flash the old text.
  const [editing, setEditing] = useState(false);
  const [savedBio, setSavedBio] = useState<string | undefined>();
  const [draft, setDraft] = useState(me.bio ?? '');
  const [saving, setSaving] = useState(false);
  const bio = savedBio !== undefined ? savedBio : me.bio;

  const startEdit = () => {
    setDraft(bio ?? '');
    setEditing(true);
  };

  const saveBio = async () => {
    if (!auth.user || saving) return;
    setSaving(true);
    try {
      await repository.updateProfile(auth.user.id, { bio: draft });
      setSavedBio(draft.trim() || '');
      setEditing(false);
    } catch (error) {
      showDialog('Could not save', userFacingError(error, 'Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const openViewer = (item: SpotlightItem) => {
    const position = mine.findIndex((candidate) => candidate.id === item.id);
    if (position >= 0) setViewerIndex(position);
  };

  return (
    <>
      <ScrollView
        style={{ backgroundColor: theme.bg }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}>
        <View style={styles.hero}>
          <Avatar name={me.displayName} uri={me.photoUri} size={84} />
          <View style={styles.heroCopy}>
            <Text variant="display" center>
              {me.displayName}
            </Text>
            {me.username ? (
              <Text variant="body" color="textFaint" center>
                @{me.username}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Bio — public, and editable only here. */}
        {editing ? (
          <View style={[styles.bioCard, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            <TextInput
              value={draft}
              onChangeText={(text) => setDraft(text.slice(0, BIO_LIMIT))}
              placeholder="Say something about yourself. Friends can see this."
              placeholderTextColor={theme.textFaint}
              multiline
              style={[styles.bioInput, { color: theme.text }]}
              autoFocus
            />
            <View style={styles.bioActions}>
              <Text variant="micro" color="textFaint">
                {draft.length}/{BIO_LIMIT}
              </Text>
              <View style={styles.bioButtons}>
                <Button variant="ghost" label="Cancel" onPress={() => setEditing(false)} disabled={saving} />
                <Button label="Save" onPress={saveBio} loading={saving} disabled={saving} />
              </View>
            </View>
          </View>
        ) : (
          <View style={[styles.bioCard, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            <Text variant="body" color={bio ? 'text' : 'textFaint'}>
              {bio ?? 'No bio yet. Add a line so friends know who they are talking to.'}
            </Text>
            <Button
              variant="ghost"
              label={bio ? 'Edit bio' : 'Add a bio'}
              icon={<Ionicons name="create-outline" size={16} color={theme.primary} />}
              onPress={startEdit}
            />
          </View>
        )}

        {/* Reactions your posts have drawn — yours to see, no one else's. */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text variant="micro" color="textFaint">
              REACTIONS YOU{'\u2019'}VE RECEIVED
            </Text>
            <Ionicons name="lock-closed" size={11} color={theme.textFaint} />
          </View>
          <View style={[styles.reactionCard, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            {totals === undefined ? (
              <View style={styles.reactionLoading}>
                <ActivityIndicator color={theme.primary} />
              </View>
            ) : (
              REACTIONS.map(({ kind, emoji, label }) => (
                <View key={kind} style={styles.reactionStat}>
                  <Text style={styles.reactionEmoji}>{emoji}</Text>
                  <Text variant="title">{totals[kind]}</Text>
                  <Text variant="micro" color="textFaint">
                    {label}
                  </Text>
                </View>
              ))
            )}
          </View>
          <Text variant="caption" color="textFaint" center>
            {totalReactions === undefined
              ? 'Only you can see these.'
              : `${totalReactions} in total, and only you can see them.`}
          </Text>
        </View>

        <View style={styles.section}>
          <Text variant="micro" color="textFaint">
            YOUR POSTS
          </Text>
          {!mine.length ? (
            <DataState
              compact
              icon="sparkles-outline"
              title="You haven't posted yet"
              detail="Share something to the friend board and it will show up here."
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
        </View>
      </ScrollView>

      {viewerIndex !== null ? (
        <MediaViewer items={mine} startIndex={viewerIndex} onClose={() => setViewerIndex(null)} />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.lg },
  hero: { alignItems: 'center', gap: Spacing.md, paddingTop: Spacing.sm },
  heroCopy: { gap: 2, alignItems: 'center' },
  bioCard: {
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.base,
    gap: Spacing.sm,
  },
  bioInput: { fontFamily: Font.sans, fontSize: 16, minHeight: 64, textAlignVertical: 'top' },
  bioActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bioButtons: { flexDirection: 'row', gap: Spacing.sm },
  section: { gap: Spacing.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  reactionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.base,
    paddingHorizontal: Spacing.sm,
  },
  reactionStat: { alignItems: 'center', gap: 3, flex: 1 },
  reactionLoading: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm },
  reactionEmoji: { fontSize: 20 },
});
