import { Ionicons } from '@expo/vector-icons';
import { type Href, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { Avatar } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { DataState } from '@/components/ui/data-state';
import { Photo } from '@/components/ui/photo';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useLog, useMemories, useMoments, useNotes, useSpace, useStreak, useUser, YOU_ID } from '@/lib/store';
import { dayKeyIn, relativeDay } from '@/lib/time';

export default function UsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { notes } = useNotes();
  const moments = useMoments();
  const streak = useStreak();
  const { habits, today } = useLog();
  const space = useSpace();
  const { memories } = useMemories();
  const completed = habits.filter((task) => today.habits[task.id]?.[YOU_ID]).length;

  /*
   * The next thing in the shared calendar.
   *
   * This row used to read "Dinner call · tonight at 8:00" for everyone — a
   * hardcoded string left over from the design mock, which looked like a real
   * event and was not one.
   */
  const todayKey = dayKeyIn();
  const nextEvent = memories
    .filter((memory) => memory.kind === 'milestone' && memory.date >= todayKey)
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  return (
    <Screen gradient>
      {/* The pair named this space when they created it; nothing showed it back
          to them afterwards. */}
      <AppHeader title={space.name?.trim() || 'Us'} subtitle="Your shared space" />
      <View style={styles.body}>
        <SectionHeader
          overline="Moments"
          title="Recently shared"
          action="Memories"
          onAction={() => router.push('/memories')}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.momentsBleed}
          contentContainerStyle={styles.momentsRow}>
          {!moments.length ? (
            <DataState compact style={styles.momentsEmpty} icon="images-outline" title="No moments yet" detail="Add one from Memories." />
          ) : moments.slice(0, 4).map((moment) => (
            <Pressable key={moment.id} onPress={() => router.push('/memories')} style={styles.moment}>
              <Photo seed={moment.seed} width={360} height={440} wash={2} scrim style={styles.momentPhoto}>
                <View style={styles.momentCaption}>
                  <Text variant="captionStrong" onPhoto numberOfLines={2}>{moment.caption}</Text>
                </View>
              </Photo>
            </Pressable>
          ))}
        </ScrollView>

        <SectionHeader overline="Shared activity" title="Updates" />
        <View style={[styles.updates, { borderTopColor: theme.line, borderBottomColor: theme.line }]}>
          <UpdateRow icon="flame-outline" title="Streak" detail={`${streak.count} day streak · keep showing up`} />
          <UpdateRow
            icon="calendar-outline"
            title="Calendar"
            detail={
              nextEvent
                ? `${nextEvent.title} · ${relativeDay(nextEvent.date)}`
                : 'Nothing coming up — import from Google Calendar'
            }
            onPress={() => router.push('/calendar')}
          />
          <UpdateRow icon="images-outline" title="Memories" detail={`${moments.length} moments saved together`} onPress={() => router.push('/memories')} />
          <UpdateRow icon="checkbox-outline" title="2do" detail={`${completed} of ${habits.length} completed by you`} onPress={() => router.push('/todo')} />
          <UpdateRow icon="gift-outline" title="Goodies" detail="See what arrived today" onPress={() => router.push('/goodies' as Href)} last />
        </View>

        <SectionHeader
          overline="Notes board"
          title="Little notes"
          action="Open"
          onAction={() => router.push('/us/notes')}
        />
        <View style={{ gap: Spacing.sm }}>
          {!notes.length ? (
            <DataState compact icon="document-text-outline" title="No notes yet" detail="Open the board to leave the first one." />
          ) : notes.slice(0, 2).map((n) => (
            <NoteRow key={n.id} authorId={n.authorId} text={n.text} at={n.createdAt} pinned={n.pinned} />
          ))}
        </View>
      </View>
    </Screen>
  );
}

function UpdateRow({
  icon,
  title,
  detail,
  onPress,
  last = false,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  detail: string;
  onPress?: () => void;
  last?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.updateRow,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.line },
        pressed && { opacity: 0.65 },
      ]}>
      <View style={[styles.updateIcon, { backgroundColor: theme.surfaceAlt }]}>
        <Ionicons name={icon} size={18} color={theme.textSoft} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="caption" color="textFaint">{detail}</Text>
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={16} color={theme.textFaint} /> : null}
    </Pressable>
  );
}

function NoteRow({ authorId, text, at, pinned }: { authorId: string; text: string; at: string; pinned?: boolean }) {
  const theme = useTheme();
  const user = useUser(authorId);
  const mine = authorId === YOU_ID;
  return (
    <Card padded elevation="subtle" style={{ flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' }}>
      <View style={[styles.noteBar, { backgroundColor: mine ? theme.primary : theme.partner }]} />
      <Avatar name={user.displayName} seed={user.photoSeed} uri={user.photoUri} ring={user.color} size={32} />
      <View style={{ flex: 1 }}>
        <Text variant="serif" style={{ fontSize: 15, lineHeight: 23 }}>
          {text}
        </Text>
        <Text variant="micro" color="textFaint" style={{ marginTop: 6 }}>
          {(mine ? 'YOU' : user.displayName.toUpperCase())} · {relativeDay(at.slice(0, 10)).toUpperCase()}
        </Text>
      </View>
      {pinned && <Ionicons name="bookmark" size={15} color={theme.gold} />}
    </Card>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: Spacing.lg, gap: Spacing.md },
  momentsBleed: { marginHorizontal: -Spacing.lg },
  momentsRow: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  momentsEmpty: { width: 260 },
  moment: { width: 142 },
  momentPhoto: { height: 172, borderRadius: Radius.tile },
  momentCaption: { flex: 1, justifyContent: 'flex-end', padding: Spacing.md },
  updates: {
    marginHorizontal: -Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  updateRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  updateIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  noteBar: { width: 3, borderRadius: 2, alignSelf: 'stretch' },
});
