import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Flame, Sprig } from '@/components/art/botanicals';
import { Avatar } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { DataState } from '@/components/ui/data-state';
import { Photo } from '@/components/ui/photo';
import { HeroSlideshow } from '@/components/hero-slideshow';
import { SetupChecklist } from '@/components/setup-checklist';
import { MoodPicker } from '@/components/mood-picker';
import { TaskCompletionDialog } from '@/components/task-completion-dialog';
import { SectionHeader } from '@/components/ui/section-header';
import { Text } from '@/components/ui/text';
import { UnpairedNotice } from '@/components/unpaired-notice';
import { Gradients, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { moodOf, type MoodKey } from '@/lib/moods';
import {
  PARTNER_ID,
  useBackendStatus,
  useGoodies,
  useLog,
  useMe,
  usePartner,
  usePresence,
  useSpace,
  useStreak,
  useTodayQuestion,
  YOU_ID,
} from '@/lib/store';
import { localTimeIn, partOfDayIn } from '@/lib/time';

export default function HomeScreen() {
  return (
    <View style={{ flex: 1 }}>
      <PresenceHero />
      <Body />
      {/* Last, so its controls sit above the absolutely-filled body scroll. */}
      <HeroBrand />
    </View>
  );
}

/**
 * The hero's identity row and mood control, drawn *above* the scrolling body.
 *
 * `Body` is an absolutely-filled ScrollView layered over `PresenceHero`, so
 * anything rendered inside the hero is beneath it and cannot be tapped — which
 * is why the mood chip appeared inert. Rendering this last puts the only
 * interactive parts of the hero back on top, while the rest of the hero stays
 * behind the scroll surface where it belongs.
 */
function HeroBrand() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const me = useMe();
  const partner = usePartner();
  const myPresence = usePresence(YOU_ID);
  const { setMood } = useLog();
  const [pickingMood, setPickingMood] = useState(false);
  const myMood = moodOf(myPresence.mood);
  const myMoodLabel = myPresence.statusText?.trim() || myMood.label;

  return (
    <View pointerEvents="box-none" style={styles.brandLayer}>
      <View style={[styles.heroBrand, { paddingTop: insets.top + Spacing.base }]}>
        {/* Home hides the floating profile avatar because these two would sit
            underneath it, so this pair carries the route to the profile. */}
        <Pressable
          onPress={() => router.push('/modal')}
          accessibilityRole="button"
          accessibilityLabel="Open your profile"
          hitSlop={8}
          style={({ pressed }) => [styles.pairRow, pressed && { opacity: 0.75 }]}>
          <Avatar name={me.displayName} seed={me.photoSeed} uri={me.photoUri} ring="you" size={34} />
          <View style={styles.pairOverlap}>
            <Avatar
              name={partner.displayName}
              seed={partner.photoSeed}
              uri={partner.photoUri}
              ring="them"
              size={34}
            />
          </View>
        </Pressable>
        {/* Sits in the left cluster on purpose: the notification bell floats at
            the top-right of every tab and was covering this control entirely,
            which is why the mood picker looked like it did not exist. */}
        <Pressable
          onPress={() => setPickingMood(true)}
          accessibilityRole="button"
          accessibilityLabel={`Your mood: ${myMoodLabel}. Tap to change.`}
          style={({ pressed }) => [
            styles.myMood,
            {
              backgroundColor: 'rgba(18,17,16,0.38)',
              borderColor: 'transparent',
            },
            pressed && { opacity: 0.75 },
          ]}>
          <View style={[styles.moodDot, { backgroundColor: myMood.color }]} />
          <Text variant="micro" onPhoto>
            {myMoodLabel.toUpperCase()}
          </Text>
          <Ionicons
            name="chevron-down"
            size={12}
            color="rgba(255,252,247,0.8)"
          />
        </Pressable>
      </View>

      {pickingMood ? (
        <MoodPicker
          current={myPresence.mood as MoodKey}
          statusText={myPresence.statusText}
          onSelect={setMood}
          onClose={() => setPickingMood(false)}
        />
      ) : null}
    </View>
  );
}

function Body() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const heroHeight = Math.min(height * 0.46, 420);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: insets.bottom + 116 }}
      style={StyleSheet.absoluteFill}>
      {/* spacer that lets the hero show through */}
      <View style={{ height: heroHeight - 34 }} pointerEvents="none" />
      <ContentSheet />
    </ScrollView>
  );
}

/** Full-bleed photographic hero carrying the partner's presence. */
function PresenceHero() {
  const { height } = useWindowDimensions();
  const partner = usePartner();
  const me = useMe();
  const presence = usePresence(PARTNER_ID);
  const space = useSpace();
  const sync = useBackendStatus();
  const { goodies } = useGoodies();

  const heroHeight = Math.min(height * 0.46, 420);
  const hasMedia = goodies.some(
    (goodie) => (goodie.kind === 'photo' || goodie.kind === 'video') && goodie.uri,
  );
  const paired = sync.mode !== 'live' || sync.paired;
  const mood = moodOf(presence.mood);
  const moodLabel = presence.statusText?.trim() || mood.label;
  const part = partOfDayIn(partner.timezone);
  // Their clock is only worth showing when it differs from yours. For couples
  // in the same zone it is your own time echoed back, so show when they were
  // last around instead — the thing you actually cannot see for yourself.
  const sameZone = partner.timezone === me.timezone;
  const time = localTimeIn(partner.timezone);
  const city = partner.timezone.split('/')[1]?.replace('_', ' ') ?? '';

  return (
    <Photo
      width={800}
      height={900}
      wash={2}
      style={{ height: heroHeight, width: '100%' }}>
      {/* Recent Goodies play behind the presence overlay. */}
      <HeroSlideshow goodies={goodies} height={heroHeight} />
      {/* Exactly one scrim. `Photo`'s own `scrim` prop paints the same gradient,
          so passing both stacked two 0.66-alpha blacks to roughly 0.88.
          Only over real photography: the empty-state ground is already a deep
          solid, and darkening that as well turned the hero into a black slab. */}
      {hasMedia ? (
        <LinearGradient
          colors={Gradients.photoScrim}
          locations={Gradients.photoScrimStops}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      {/* The dark backing the status bar's light icons sit on. */}
      <LinearGradient
        colors={Gradients.topScrim}
        style={styles.topScrim}
        pointerEvents="none"
      />
      <Animated.View entering={FadeIn.duration(500)} style={styles.heroBody}>
        {/* Unpaired, every one of these is invented: a placeholder name, a mood
            nobody set, and "Active just now" for an account that does not
            exist. Say there is nobody here instead. */}
        {paired ? (
          <>
            <View style={styles.heroMeta}>
              <View style={[styles.moodDot, { backgroundColor: mood.color }]} />
              <Text variant="micro" onPhoto style={{ opacity: 0.9 }}>
                {moodLabel.toUpperCase()} · {part.toUpperCase()}
              </Text>
            </View>
            <Text variant="hero" onPhoto style={{ marginTop: 6 }}>
              {partner.displayName}
            </Text>
            <View style={styles.heroFacts}>
              {sameZone ? (
                <Fact icon="pulse-outline" label={lastSeen(presence.updatedAt)} onPhoto />
              ) : (
                <Fact icon="time-outline" label={city ? `${time} · ${city}` : time} onPhoto />
              )}
              {space.mode === 'distance' && presence.weather && (
                <Fact
                  icon="rainy-outline"
                  label={`${presence.weather.tempC}° ${presence.weather.label}`}
                  onPhoto
                />
              )}
            </View>
          </>
        ) : (
          <>
            <Text variant="micro" onPhoto style={{ opacity: 0.9 }}>
              NOT PAIRED YET
            </Text>
            <Text variant="hero" onPhoto style={{ marginTop: 6 }}>
              Your space
            </Text>
            <View style={styles.heroFacts}>
              <Fact icon="heart-outline" label="Pair to see their mood and their time" onPhoto />
            </View>
          </>
        )}
      </Animated.View>

    </Photo>
  );
}

/** "Active just now" / "Active 2h ago" — used when a clock would be redundant. */
function lastSeen(updatedAt: string) {
  const minutes = Math.round((Date.now() - new Date(updatedAt).getTime()) / 60000);
  if (!Number.isFinite(minutes) || minutes < 2) return 'Active just now';
  if (minutes < 60) return `Active ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Active ${hours}h ago`;
  return `Active ${Math.round(hours / 24)}d ago`;
}

function Fact({
  icon,
  label,
  onPhoto,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPhoto?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={styles.fact}>
      <Ionicons name={icon} size={13} color={onPhoto ? 'rgba(255,252,247,0.85)' : theme.textSoft} />
      <Text variant="caption" onPhoto={onPhoto} color="textSoft" style={{ opacity: 0.9 }}>
        {label}
      </Text>
    </View>
  );
}

/** The scrolling sheet that rides up over the hero. */
function ContentSheet() {
  const theme = useTheme();
  const sync = useBackendStatus();
  // Streak, shared 2dos and the daily question are all two-person features:
  // with nobody to share them with they render as zeroes and empty states,
  // which reads as a broken app rather than an unfinished setup.
  const paired = sync.mode !== 'live' || sync.paired;

  return (
    <View style={[styles.sheet, { backgroundColor: theme.bg }]}>
      <View style={[styles.grabber, { backgroundColor: theme.lineStrong }]} />
      <View style={styles.body}>
        {paired ? null : (
          <UnpairedNotice
            title="Pair to unlock your space"
            detail="Your streak, shared 2dos, the daily question and Goodies all need two people. Friends, your profile and notifications work right now."
          />
        )}
        <SetupChecklist />
        {paired ? (
          <>
            <SimpleStreak />
            <TaskOverview />
            <QuestionCard />
          </>
        ) : null}
      </View>
    </View>
  );
}

function SimpleStreak() {
  const theme = useTheme();
  const streak = useStreak();
  const encouragement =
    streak.count < 7
      ? 'A lovely rhythm — keep it going.'
      : streak.count < 30
        ? 'You’re building a beautiful habit.'
        : 'Still showing up, one moment at a time.';

  return (
    <View style={styles.simpleStreak}>
      <View style={[styles.streakIcon, { backgroundColor: theme.partnerSoft }]}>
        <Flame size={21} color={theme.partner} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="micro" color="textFaint">CURRENT STREAK</Text>
        <Text variant="title">{streak.count} day streak</Text>
        <Text variant="caption" color="textFaint" style={styles.streakEncouragement}>
          {encouragement}
        </Text>
      </View>
      <Ionicons name="heart" size={18} color={theme.partner} />
    </View>
  );
}

function TaskOverview() {
  const theme = useTheme();
  const router = useRouter();
  const { habits, today, toggleHabit } = useLog();
  const [noteTask, setNoteTask] = useState<{ id: string; label: string }>();

  return (
    <View style={styles.taskOverview}>
      <SectionHeader overline="2do" title="Up next" action="See all" onAction={() => router.push('/todo')} />
      <View style={[styles.taskRows, { borderTopColor: theme.line, borderBottomColor: theme.line }]}>
        {!habits.length ? (
          <DataState compact icon="checkbox-outline" title="No shared 2dos yet" detail="Open See all to add the first one." />
        ) : habits.slice(0, 3).map((task, index) => {
          const done = today.habits[task.id]?.[YOU_ID] ?? false;
          return (
            <Pressable
              key={task.id}
              onPress={() => {
                if (!done && task.noteRequired) setNoteTask({ id: task.id, label: task.label });
                else toggleHabit(task.id);
              }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: done }}
              accessibilityLabel={`${task.label}, ${done ? 'complete' : 'not complete'}`}
              style={[
                styles.taskRow,
                index > 0 && { borderTopColor: theme.line, borderTopWidth: StyleSheet.hairlineWidth },
              ]}>
              <View
                style={[
                  styles.taskCheck,
                  { borderColor: done ? task.color : theme.lineStrong, backgroundColor: done ? task.color : 'transparent' },
                ]}>
                {done ? <Ionicons name="checkmark" size={12} color="#FFFCF7" /> : null}
              </View>
              <Text
                variant="bodyStrong"
                style={[styles.taskLabel, done && styles.taskLabelDone]}
                numberOfLines={1}>
                {task.label}
              </Text>
              <Text variant="micro" color="textFaint">{task.routine.toUpperCase()}</Text>
            </Pressable>
          );
        })}
      </View>
      <TaskCompletionDialog
        key={noteTask?.id ?? 'no-task'}
        task={noteTask}
        onCancel={() => setNoteTask(undefined)}
        onComplete={(id, note) => {
          toggleHabit(id, note);
          setNoteTask(undefined);
        }}
      />
    </View>
  );
}

function QuestionCard() {
  const theme = useTheme();
  const router = useRouter();
  const partner = usePartner();
  const { question, answered, partnerAnswered, revealed } = useTodayQuestion();
  const status = revealed
    ? 'You both answered'
    : answered
      ? `Waiting for ${partner.displayName}`
      : partnerAnswered
        ? `${partner.displayName} answered · your turn`
        : 'Neither of you has answered yet';

  return (
    <>
      <SectionHeader overline="Today" title="One question a day" />
      <Card padded onPress={() => router.push('/play/question')} elevation="soft">
        <View style={styles.quoteMark}>
          <Sprig size={44} color={theme.primary} opacity={0.28} />
        </View>
        <Text variant="display" style={{ paddingRight: 40 }}>
          {question.text}
        </Text>
        <View style={[styles.qFooter, { borderTopColor: theme.line }]}>
          <View style={styles.row6}>
            <View
              style={[
                styles.qStatus,
                { backgroundColor: answered ? theme.primarySoft : theme.partnerSoft },
              ]}>
              <Ionicons
                name={answered ? 'checkmark' : 'ellipsis-horizontal'}
                size={12}
                color={answered ? theme.primaryDeep : theme.partner}
              />
            </View>
            <Text variant="caption" color="textSoft">
              {status}
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={16} color={theme.textFaint} />
        </View>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  brandLayer: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20 },
  heroBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingLeft: Spacing.lg,
    // Clear of the floating notification bell (48px + its own right inset).
    paddingRight: Spacing.lg + 60,
  },
  topScrim: { position: 'absolute', top: 0, left: 0, right: 0, height: 130 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pairRow: { flexDirection: 'row', alignItems: 'center' },
  // Partner tucks behind so the two faces read as one pair, not two avatars.
  pairOverlap: { marginLeft: -14 },
  myMood: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  heroBody: { position: 'absolute', left: Spacing.lg, right: Spacing.lg, bottom: 52 },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  moodDot: { width: 8, height: 8, borderRadius: 4 },
  heroQuote: { marginTop: 8, opacity: 0.95, paddingRight: Spacing.lg },
  heroFacts: { flexDirection: 'row', gap: Spacing.base, marginTop: Spacing.md },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sheet: {
    borderTopLeftRadius: Radius.hero,
    borderTopRightRadius: Radius.hero,
    paddingTop: Spacing.md,
    minHeight: 720,
  },
  grabber: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', opacity: 0.7 },
  body: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, gap: Spacing.md },

  simpleStreak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  streakIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  streakEncouragement: { marginTop: 2 },
  taskOverview: { marginTop: Spacing.sm },
  taskRows: {
    marginHorizontal: -Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  taskRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  taskCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskLabel: { flex: 1 },
  taskLabelDone: { opacity: 0.55, textDecorationLine: 'line-through' },

  quoteMark: { position: 'absolute', top: 10, right: 12 },
  qFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
  },
  row6: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  qStatus: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

});
