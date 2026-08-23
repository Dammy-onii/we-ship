import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppHeader } from '@/components/app-header';
import { Leaf, Moon, Sprig } from '@/components/art/botanicals';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Photo } from '@/components/ui/photo';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { Text } from '@/components/ui/text';
import { Radius, Shadow, Spacing } from '@/constants/theme';
import { showDialog } from '@/components/ui/dialog';
import { useTheme } from '@/hooks/use-theme';
import { userFacingError } from '@/lib/user-facing-error';
import { useAuth } from '@/lib/auth';
import * as games from '@/lib/backend/games';
import { useBackendStatus, usePartner, useTodayQuestion } from '@/lib/store';

type ArtFn = (p: { size?: number; color?: string; opacity?: number }) => React.ReactElement;

const GAMES: {
  id: string;
  title: string;
  blurb: string;
  Art: ArtFn;
  tone: 'primary' | 'bloom' | 'accent' | 'gold';
  soon?: boolean;
}[] = [
  { id: 'draw', title: 'Draw together', blurb: 'Coming soon', Art: Leaf, tone: 'accent', soon: true },
  { id: 'memory', title: 'Photo memory', blurb: 'Coming soon', Art: Moon, tone: 'gold', soon: true },
];

const TOP_GAMES = [
  {
    id: 'scene',
    soon: true,
    eyebrow: 'SCENE PACKS',
    title: 'Our Take',
    blurb: 'Play through changing scenes, choices, and reactions, then compare together.',
    icon: 'videocam' as const,
    seed: 'ws-scene',
    colors: ['rgba(76,68,84,0.42)', 'rgba(35,32,39,0.80)'] as const,
  },
  {
    id: 'wyr',
    eyebrow: 'QUICK GAME',
    title: 'Would you rather',
    blurb: 'Pick a side, reveal together, and see how well you match.',
    icon: 'git-compare-outline' as const,
    seed: 'ws-wyr',
    colors: ['rgba(76,84,82,0.34)', 'rgba(35,42,40,0.82)'] as const,
    soon: true,
  },
  {
    id: 'tod',
    eyebrow: 'QUICK GAME',
    title: 'Truth or dare',
    blurb: 'A softer deck for playful calls and slow evenings.',
    icon: 'sparkles-outline' as const,
    seed: 'ws-truth',
    colors: ['rgba(96,72,76,0.32)', 'rgba(54,39,42,0.82)'] as const,
    soon: true,
  },
];

export default function PlayScreen() {
  const theme = useTheme();
  const router = useRouter();
  const partner = usePartner();
  const { answered, partnerAnswered, revealed } = useTodayQuestion();
  const { width } = useWindowDimensions();
  const [activeGame, setActiveGame] = useState(0);
  const tile = (width - Spacing.lg * 2 - Spacing.md) / 2;

  return (
    <Screen gradient>
      <AppHeader title="Play" subtitle="Little things, together" />
      <View style={styles.body}>
        <TogetherPick />

        {/* Daily question */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <Card padded onPress={() => router.push('/play/question')} elevation="soft">
            <View style={styles.rowBetween}>
              <View style={styles.tag}>
                <Sprig size={17} color={theme.primary} />
                <Text variant="micro" color="textFaint">
                  DAILY QUESTION
                </Text>
              </View>
              <View
                style={[
                  styles.status,
                  { backgroundColor: answered ? theme.primarySoft : theme.partnerSoft },
                ]}>
                <Ionicons
                  name={answered ? 'checkmark' : 'ellipsis-horizontal'}
                  size={12}
                  color={answered ? theme.primaryDeep : theme.partner}
                />
              </View>
            </View>
            <Text variant="title" style={{ marginTop: Spacing.md }}>
              {revealed ? 'You both answered today' : answered ? 'Your answer is in' : 'Answer today’s question'}
            </Text>
            <Text variant="caption" color="textSoft" style={{ marginTop: 4 }}>
              {revealed
                ? 'Tap to revisit your answers'
                : answered
                  ? `Waiting for ${partner.displayName}`
                  : partnerAnswered
                    ? `${partner.displayName} answered · your turn`
                    : 'Be the first to answer today'}
            </Text>
          </Card>
        </Animated.View>
        <Button
          full
          size="sm"
          variant="soft"
          label="Add a question to your queue"
          icon={<Ionicons name="add" size={18} color={theme.primaryDeep} />}
          onPress={() => router.push('/play/questions')}
        />

        <SectionHeader overline="Featured" title="Top games" />
        <ScrollView
          horizontal
          pagingEnabled
          decelerationRate="fast"
          snapToInterval={width}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) =>
            setActiveGame(Math.round(event.nativeEvent.contentOffset.x / width))
          }
          style={styles.carousel}
          contentContainerStyle={styles.carouselContent}>
          {TOP_GAMES.map((game) => (
            <Pressable
              key={game.id}
              disabled={'soon' in game && game.soon}
              onPress={() => {
                if ('soon' in game && game.soon) return;
                if (game.id === 'scene') router.push('/play/scenes');
                else router.push(`/play/game/${game.id}`);
              }}
              style={{ width }}>
              <Photo seed={game.seed} width={800} height={620} wash={5} scrim style={styles.topGame}>
                <LinearGradient colors={game.colors} style={StyleSheet.absoluteFill} />
                <View style={styles.sceneInner}>
                  <View style={styles.tag}>
                    <View style={styles.sceneBadge}>
                      <Ionicons name={game.icon} size={12} color="#FFFCF7" />
                    </View>
                    <Text variant="micro" onPhoto style={{ opacity: 0.9 }}>{game.eyebrow}</Text>
                  </View>
                  <View style={{ flex: 1 }} />
                  <Text variant="hero" onPhoto>{game.title}</Text>
                  <Text variant="caption" onPhoto style={styles.topGameBlurb}>{game.blurb}</Text>
                  <View style={styles.playPill}>
                    <Ionicons
                      name={'soon' in game && game.soon ? 'time-outline' : 'play'}
                      size={15}
                      color="#46413D"
                    />
                    <Text variant="captionStrong" style={{ color: '#46413D' }}>
                      {'soon' in game && game.soon ? 'Coming soon' : 'Play now'}
                    </Text>
                  </View>
                </View>
              </Photo>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.pagination}>
          {TOP_GAMES.map((game, index) => (
            <View key={game.id} style={[styles.pageDot, { backgroundColor: index === activeGame ? theme.primary : theme.lineStrong }]} />
          ))}
        </View>

        {/* Casual games */}
        <SectionHeader overline="Coming next" title="More ways to play" />
        <View style={styles.grid}>
          {GAMES.map((g, i) => {
            const color = theme[g.tone];
            return (
              <Animated.View key={g.id} entering={FadeInDown.duration(360).delay(120 + i * 60)}>
                <Pressable
                  disabled={g.soon}
                  onPress={() => router.push(`/play/game/${g.id}`)}
                  style={({ pressed }) => [
                    styles.game,
                    Shadow.subtle,
                    {
                      width: tile,
                      backgroundColor: theme.surface,
                      borderColor: theme.line,
                    },
                    pressed && !g.soon && { transform: [{ scale: 0.98 }] },
                    g.soon && { opacity: 0.5 },
                  ]}>
                  <View style={[styles.gameArt, { backgroundColor: color + '18' }]}>
                    <g.Art size={26} color={color} />
                  </View>
                  <Text variant="bodyStrong">{g.title}</Text>
                  <Text variant="caption" color="textFaint">
                    {g.blurb}
                  </Text>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
      </View>
    </Screen>
  );
}

const TOGETHER_OPTIONS = [
  { id: 'call', label: 'Voice call', icon: 'call-outline' as const },
  { id: 'watch', label: 'Watch together', icon: 'play-circle-outline' as const },
  { id: 'questions', label: 'Question round', icon: 'chatbubbles-outline' as const },
];

function TogetherPick() {
  const theme = useTheme();
  const router = useRouter();
  const partner = usePartner();
  const auth = useAuth();
  const sync = useBackendStatus();
  const [choice, setChoice] = useState<string>();
  const [game, setGame] = useState<games.ChoiceGameState>();
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const revealedEntries = Object.entries(game?.revealed ?? {});
  const partnerChoice = sync.mode === 'live'
    ? revealedEntries.find(([userId]) => userId !== auth.user?.id)?.[1]
    : 'watch';
  const partnerPicked = sync.mode === 'live'
    ? (game?.submittedCount ?? 0) > (game?.myChoice ? 1 : 0)
    : true;
  const matched = Boolean(choice && partnerChoice && choice === partnerChoice);
  const complete = sync.mode === 'live' ? game?.status === 'complete' : Boolean(choice);
  const currentOptions = sync.mode === 'live' && game?.options?.length
    ? game.options
    : TOGETHER_OPTIONS;
  const currentQuestion = sync.mode === 'live' && game?.question
    ? game.question
    : 'What should we do tonight?';

  const load = useCallback(async (showLoading = false) => {
    if (sync.mode !== 'live' || !sync.paired) return;
    if (showLoading) setLoading(true);
    try {
      const state = await games.openChoiceGame('tonight-pick');
      setGame(state);
      setChoice(state.myChoice);
      setError(undefined);
    } catch (reason) {
      setError(userFacingError(reason, 'Could not open this shared pick.'));
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [sync.mode, sync.paired]);

  useEffect(() => {
    if (sync.mode !== 'live' || !sync.paired) return;
    const initial = setTimeout(() => load(true), 0);
    const timer = setInterval(() => load(false), 3500);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [load, sync.mode, sync.paired]);

  const choose = async (id: string) => {
    Haptics.selectionAsync().catch(() => {});
    setChoice(id);
    if (sync.mode === 'live' && game?.sessionId) {
      setBusy(true);
      try {
        const state = await games.submitChoice(game.sessionId, id);
        setGame(state);
        setChoice(state.myChoice);
        setError(undefined);
      } catch (reason) {
        setChoice(game.myChoice);
        showDialog('Could not save your choice', userFacingError(reason, 'Please try again.'));
      } finally {
        setBusy(false);
      }
    }
  };

  const again = async () => {
    if (sync.mode !== 'live') {
      setChoice(undefined);
      return;
    }
    setBusy(true);
    try {
      const state = await games.startChoiceGame('tonight-pick');
      setGame(state);
      setChoice(state.myChoice);
      setError(undefined);
    } catch (reason) {
      showDialog('Could not start another pick', userFacingError(reason, 'Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.pickSection, { borderBottomColor: theme.lineStrong }]}>
      <View style={styles.rowBetween}>
        <View style={styles.tag}>
          <Ionicons name="heart-circle-outline" size={19} color={theme.partner} />
          <Text variant="micro" color="textFaint">PICK TOGETHER</Text>
        </View>
        <View style={[styles.partnerWaiting, { backgroundColor: partnerPicked ? theme.partnerSoft : theme.surfaceAlt }]}>
          <View style={[styles.waitingDot, { backgroundColor: theme.partner }]} />
          <Text variant="micro" color="textSoft">
            {loading ? 'OPENING' : `${partner.displayName.toUpperCase()} ${partnerPicked ? 'PICKED' : 'IS CHOOSING'}`}
          </Text>
        </View>
      </View>
      <Text variant="display" style={styles.pickTitle}>{currentQuestion}</Text>
      <View style={styles.pickSubhead}>
        <Text variant="body" color="textSoft" style={{ flex: 1 }}>Your choices stay private until both of you pick.</Text>
        <Pressable
          onPress={() => router.push('/play/picks')}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Open Pick Together question queue"
          style={[styles.queueLink, { backgroundColor: theme.primarySoft }]}>
          <Ionicons name="list-outline" size={15} color={theme.primaryDeep} />
          <Text variant="captionStrong" color="primaryDeep">Queue</Text>
        </Pressable>
      </View>
      {error ? (
        <View style={[styles.pickError, { backgroundColor: theme.partnerSoft }]}>
          <Text variant="caption" color="textSoft" style={{ flex: 1 }}>{error}</Text>
          <Pressable onPress={() => load(true)} hitSlop={8}>
            <Text variant="captionStrong" color="primaryDeep">Retry</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={styles.pickOptions}>
        {currentOptions.map((option) => {
          const selected = choice === option.id;
          return (
            <Pressable
              key={option.id}
              disabled={busy || loading || (sync.mode === 'live' && (!game || game.status === 'complete'))}
              onPress={() => choose(option.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={({ pressed }) => [
                styles.pickOption,
                {
                  backgroundColor: selected ? theme.primarySoft : theme.surfaceAlt,
                  borderColor: selected ? theme.primary : theme.line,
                },
                pressed && { opacity: 0.7 },
              ]}>
              <Ionicons name={pickOptionIcon(option.id)} size={18} color={selected ? theme.primaryDeep : theme.textSoft} />
              <Text variant="captionStrong" color={selected ? 'primaryDeep' : 'textSoft'}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {choice && partnerChoice ? (
        <View style={[styles.pickResult, { borderTopColor: theme.line }]}>
          <Ionicons
            name={matched ? 'sparkles' : 'heart-outline'}
            size={18}
            color={matched ? theme.gold : theme.partner}
          />
          <Text variant="bodyStrong" style={{ flex: 1 }}>
            {matched
              ? `It’s a match — ${partner.displayName} chose that too.`
              : `${partner.displayName} chose ${currentOptions.find((item) => item.id === partnerChoice)?.label ?? 'another option'}. Two lovely options saved.`}
          </Text>
        </View>
      ) : choice ? (
        <View style={[styles.pickResult, { borderTopColor: theme.line }]}>
          <Ionicons name="time-outline" size={18} color={theme.partner} />
          <Text variant="bodyStrong" style={{ flex: 1 }}>Your choice is private until {partner.displayName} chooses.</Text>
        </View>
      ) : null}
      {complete && choice ? (
        <Button
          full
          size="sm"
          variant="soft"
          style={styles.pickAgain}
          loading={busy}
          label={busy ? 'Starting…' : 'Pick again'}
          disabled={busy}
          onPress={again}
          icon={<Ionicons name="refresh" size={17} color={theme.primaryDeep} />}
        />
      ) : null}
    </View>
  );
}

function pickOptionIcon(id: string): React.ComponentProps<typeof Ionicons>['name'] {
  if (id === 'call') return 'call-outline';
  if (id === 'watch') return 'play-circle-outline';
  if (id === 'questions') return 'chatbubbles-outline';
  return 'ellipse-outline';
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: Spacing.lg, gap: Spacing.md },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  status: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  pickSection: { paddingTop: Spacing.sm, paddingBottom: Spacing.xl, borderBottomWidth: StyleSheet.hairlineWidth },

  sceneInner: { flex: 1, padding: Spacing.lg },
  carousel: { marginHorizontal: -Spacing.lg },
  carouselContent: { alignItems: 'stretch' },
  topGame: { height: 246, width: '100%' },
  topGameBlurb: { opacity: 0.9, marginTop: 4, paddingRight: 60 },
  pagination: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: -4 },
  pageDot: { width: 18, height: 4, borderRadius: 2 },
  sceneBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,252,247,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'flex-start',
    backgroundColor: '#FFFCF7',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: Radius.pill,
    marginTop: Spacing.md,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  game: {
    borderRadius: Radius.tile,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.base,
    gap: 5,
  },
  gameArt: {
    width: 46,
    height: 46,
    borderRadius: Radius.chip,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },

  partnerWaiting: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 5, borderRadius: Radius.pill },
  waitingDot: { width: 6, height: 6, borderRadius: 3 },
  pickTitle: { marginTop: Spacing.md },
  pickSubhead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: 4 },
  queueLink: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: Spacing.sm, borderRadius: Radius.pill },
  pickOptions: { gap: Spacing.sm, marginTop: Spacing.md },
  pickOption: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: Radius.inset, borderWidth: StyleSheet.hairlineWidth },
  pickResult: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, marginTop: Spacing.md, paddingTop: Spacing.md },
  pickAgain: { marginTop: Spacing.md },
  pickError: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderRadius: Radius.inset, padding: Spacing.md, marginTop: Spacing.md },
});
