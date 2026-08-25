import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardAvoider } from '@/components/ui/keyboard-avoider';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DataState } from '@/components/ui/data-state';
import { Text } from '@/components/ui/text';
import { Font, Radius, Spacing } from '@/constants/theme';
import { showDialog } from '@/components/ui/dialog';
import { useTheme } from '@/hooks/use-theme';
import { userFacingError } from '@/lib/user-facing-error';
import { useFriends } from '@/lib/friends';
import type { PersonSummary } from '@/lib/types';

const SEARCH_DEBOUNCE_MS = 280;

export default function FriendsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { enabled, initialLoading, error, friends, incoming, outgoing, refresh, notifications } =
    useFriends();
  const joined = notifications.filter((item) => item.kind === 'contact_joined');

  if (!enabled) {
    return (
      <View style={[styles.screen, styles.center, { backgroundColor: theme.bg }]}>
        <DataState
          icon="people-outline"
          title="Friends need an account"
          detail="Sign in to search for people on Weship and follow their board."
        />
      </View>
    );
  }

  if (initialLoading) {
    return (
      <View style={[styles.screen, styles.center, { backgroundColor: theme.bg }]}>
        <DataState loading title="Loading your friends" detail="Fetching your connections and requests." />
      </View>
    );
  }

  return (
    <KeyboardAvoider
      style={[styles.screen, { backgroundColor: theme.bg }]}
      >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}>
        <View style={styles.intro}>
          <Text variant="micro" color="textFaint">PEOPLE</Text>
          <Text variant="display">Friends</Text>
          <Text variant="body" color="textSoft">
            Separate from your shared space. Connect with people to see what they post on the friend
            board.
          </Text>
        </View>

        {error ? (
          <View style={[styles.banner, { backgroundColor: theme.surfaceAlt, borderColor: theme.line }]}>
            <Ionicons name="cloud-offline-outline" size={17} color={theme.textSoft} />
            <Text variant="caption" color="textSoft" style={{ flex: 1 }}>
              {error}
            </Text>
            <Pressable onPress={() => refresh()} hitSlop={8}>
              <Text variant="captionStrong" color="primary">Retry</Text>
            </Pressable>
          </View>
        ) : null}

        <PeopleSearch />

        {joined.length ? (
          <View style={styles.section}>
            <Text variant="micro" color="textFaint">JUST JOINED</Text>
            <Text variant="title">From your contacts</Text>
            <View style={styles.list}>
              {joined.slice(0, 5).map((item) => (
                <View key={item.id} style={[styles.personRow, { borderColor: theme.line }]}>
                  <View style={[styles.joinIcon, { backgroundColor: theme.primarySoft }]}>
                    <Ionicons name="sparkles" size={16} color={theme.primaryDeep} />
                  </View>
                  <View style={styles.personText}>
                    <Text variant="bodyStrong" numberOfLines={1}>{item.title}</Text>
                    {item.body ? (
                      <Text variant="caption" color="textFaint" numberOfLines={2}>{item.body}</Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}


        {incoming.length ? (
          <View style={styles.section}>
            <Text variant="micro" color="textFaint">WAITING FOR YOU</Text>
            <Text variant="title">Requests</Text>
            <View style={styles.list}>
              {incoming.map((request) => (
                <RequestRow key={request.id} requestId={request.id} person={request.person} incoming />
              ))}
            </View>
          </View>
        ) : null}

        {outgoing.length ? (
          <View style={styles.section}>
            <Text variant="micro" color="textFaint">SENT</Text>
            <Text variant="title">Waiting on them</Text>
            <View style={styles.list}>
              {outgoing.map((request) => (
                <RequestRow key={request.id} requestId={request.id} person={request.person} />
              ))}
            </View>
          </View>
        ) : null}
        <View style={styles.section}>
          <Text variant="micro" color="textFaint">CONNECTED</Text>
          <Text variant="title">{friends.length ? `${friends.length} friend${friends.length === 1 ? '' : 's'}` : 'Your friends'}</Text>
          <View style={styles.list}>
            {friends.length ? (
              friends.map((person) => <FriendRow key={person.id} person={person} />)
            ) : (
              <DataState
                compact
                icon="person-add-outline"
                title="No friends yet"
                detail="Search for someone by their username above to send the first request."
              />
            )}
          </View>
        </View>

      </ScrollView>
    </KeyboardAvoider>
  );
}

function PeopleSearch() {
  const theme = useTheme();
  const { search, addFriend } = useFriends();
  const [term, setTerm] = useState('');
  const [pendingId, setPendingId] = useState<string>();
  // Results carry the query they belong to. That makes staleness a render-time
  // comparison rather than a ref-guarded race, and keeps the effect free of
  // synchronous setState.
  const [result, setResult] = useState<{ query: string; people: PersonSummary[] }>({
    query: '',
    people: [],
  });

  const query = term.trim();
  const active = query.length >= 2;
  const settled = result.query === query;
  const searching = active && !settled;
  const results = settled ? result.people : [];

  useEffect(() => {
    if (query.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      search(query)
        .then((people) => {
          if (!cancelled) setResult({ query, people });
        })
        .catch(() => {
          if (!cancelled) setResult({ query, people: [] });
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, query]);

  const connect = useCallback(
    async (person: PersonSummary) => {
      setPendingId(person.id);
      try {
        await addFriend(person.id);
        setResult((current) => ({
          ...current,
          people: current.people.map((item) =>
            item.id === person.id ? { ...item, status: 'outgoing' } : item,
          ),
        }));
        Keyboard.dismiss();
      } catch (cause) {
        showDialog('Could not send request', userFacingError(cause, 'Please try again.'));
      } finally {
        setPendingId(undefined);
      }
    },
    [addFriend],
  );

  return (
    <View style={styles.section}>
      <Text variant="micro" color="textFaint">FIND PEOPLE</Text>
      <View style={[styles.searchField, { backgroundColor: theme.surface, borderColor: theme.line }]}>
        <Ionicons name="search" size={18} color={theme.textFaint} />
        <TextInput
          value={term}
          onChangeText={setTerm}
          placeholder="Search by username or name"
          placeholderTextColor={theme.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          style={[styles.searchInput, { color: theme.text }]}
        />
        {term ? (
          <Pressable onPress={() => setTerm('')} hitSlop={10} accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={18} color={theme.textFaint} />
          </Pressable>
        ) : null}
      </View>

      {active ? (
        <View style={styles.list}>
          {searching ? (
            <View style={styles.searchingRow}>
              <ActivityIndicator color={theme.primary} />
              <Text variant="caption" color="textFaint">Searching…</Text>
            </View>
          ) : results.length ? (
            results.map((person) => (
              <PersonRow
                key={person.id}
                person={person}
                action={
                  person.status === 'none' ? (
                    <Button
                      loading={pendingId === person.id}
                  label={pendingId === person.id ? 'Sending…' : 'Add'}
                      size="sm"
                      variant="soft"
                      disabled={pendingId === person.id}
                      onPress={() => connect(person)}
                    />
                  ) : (
                    <Text variant="caption" color="textFaint">
                      {person.status === 'friends'
                        ? 'Friends'
                        : person.status === 'outgoing'
                          ? 'Requested'
                          : 'Wants to connect'}
                    </Text>
                  )
                }
              />
            ))
          ) : (
            <DataState
              compact
              icon="search-outline"
              title="No one found"
              detail={`Nobody on Weship matches “${query}”.`}
            />
          )}
        </View>
      ) : null}
    </View>
  );
}

function RequestRow({
  requestId,
  person,
  incoming,
}: {
  requestId: string;
  person: PersonSummary;
  incoming?: boolean;
}) {
  const { accept, decline } = useFriends();
  const [busy, setBusy] = useState(false);

  const run = async (operation: () => Promise<void>, failure: string) => {
    setBusy(true);
    try {
      await operation();
    } catch (cause) {
      showDialog(failure, userFacingError(cause, 'Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PersonRow
      person={person}
      action={
        incoming ? (
          <View style={styles.rowActions}>
            <Button
              label="Accept"
              size="sm"
              disabled={busy}
              onPress={() => run(() => accept(requestId), 'Could not accept')}
            />
            <Button
              label="Decline"
              size="sm"
              variant="ghost"
              disabled={busy}
              onPress={() => run(() => decline(requestId), 'Could not decline')}
            />
          </View>
        ) : (
          <Button
            label="Cancel"
            size="sm"
            variant="ghost"
            disabled={busy}
            onPress={() => run(() => decline(requestId), 'Could not cancel')}
          />
        )
      }
    />
  );
}

function FriendRow({ person }: { person: PersonSummary }) {
  const theme = useTheme();
  const router = useRouter();

  /*
   * Opens the friend's own page.
   *
   * This control used to raise a native action sheet — a system dialog with a
   * name, a handle, and "Remove friend" as its second line. There was nowhere
   * to see who the person actually was.
   */
  const open = () => router.push({ pathname: '/friend/[id]', params: { id: person.id } });

  return (
    <PersonRow
      person={person}
      onPress={open}
      action={<Ionicons name="chevron-forward" size={20} color={theme.textFaint} />}
    />
  );
}

function PersonRow({
  person,
  action,
  onPress,
}: {
  person: PersonSummary;
  action?: React.ReactNode;
  /** Makes the whole row — avatar included — open the person. */
  onPress?: () => void;
}) {
  const theme = useTheme();
  const Row = onPress ? Pressable : View;
  return (
    <Row
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `Open ${person.displayName}'s profile` : undefined}
      style={[styles.personRow, { borderColor: theme.line }]}>
      <Avatar name={person.displayName} uri={person.photoUri} size={44} />
      <View style={styles.personText}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {person.displayName}
        </Text>
        {person.username ? (
          <Text variant="caption" color="textFaint" numberOfLines={1}>
            @{person.username}
          </Text>
        ) : null}
      </View>
      {action}
    </Row>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.lg },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, gap: Spacing.base },
  intro: { gap: 6, marginBottom: Spacing.sm },
  section: { gap: Spacing.xs, marginTop: Spacing.lg },
  list: { gap: Spacing.xs, marginTop: Spacing.xs },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.inset,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    height: 52,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing.xs,
  },
  searchInput: { flex: 1, fontFamily: Font.sans, fontSize: 15 },
  searchingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    justifyContent: 'center',
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  personText: { flex: 1, gap: 2 },
  joinIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
});
