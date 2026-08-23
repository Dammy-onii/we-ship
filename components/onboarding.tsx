import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bloom, Leaf, Sparkle } from '@/components/art/botanicals';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Slide = {
  key: string;
  overline: string;
  title: string;
  body: string;
  /** Named capabilities, listed rather than buried in prose. */
  points?: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; detail: string }[];
  Art: (p: { size?: number; color?: string; opacity?: number }) => React.ReactElement;
};

/**
 * Three slides: what it is, what is in it, and how to start.
 *
 * Deliberately short and concrete. The middle slide lists the features by name
 * because two of them — home-screen widgets and the Drive connection — are
 * things nobody discovers on their own, and Drive in particular has to be
 * granted before photos and videos work at all.
 */
const SLIDES: Slide[] = [
  {
    key: 'overview',
    overline: 'WELCOME TO WESHIP',
    title: 'A private space for two',
    body: 'Not a feed and not a group chat. One quiet place for the two of you, with a lighter circle for friends alongside it. Nothing here is public, nothing is sold, and nothing is ever recommended to strangers.',
    Art: Leaf,
  },
  {
    key: 'features',
    overline: "WHAT'S INSIDE",
    title: 'Small things, every day',
    body: 'Enough to keep you close without becoming another chore.',
    points: [
      {
        icon: 'gift-outline',
        label: 'Goodies & Spotlight',
        detail: 'Photos, videos, notes and voice notes, gathered in a gallery of your own.',
      },
      {
        icon: 'grid-outline',
        label: 'Home-screen widgets',
        detail: 'Their photos and mood, your streak, and a nudge you can send without opening the app.',
      },
      {
        icon: 'cloud-upload-outline',
        label: 'Your own Google Drive',
        detail: 'Photo and video originals are saved to your Drive, not ours. Connect it once and sharing just works.',
      },
      {
        icon: 'checkbox-outline',
        label: '2do, questions & games',
        detail: 'Shared tasks, a question a day, and quick things to play together.',
      },
    ],
    Art: Sparkle,
  },
  {
    key: 'start',
    overline: 'GETTING STARTED',
    title: 'Three steps and you are in',
    body: 'Create your account, pair with your partner using a six-character code, then connect Drive and turn on notifications. Home keeps a short list of anything still left to do, so nothing gets lost.',
    Art: Bloom,
  },
];

/**
 * The first thing a new install shows, before Login/Register.
 *
 * Shown once per device. `onDone` hands control to the auth screen, which is
 * the next step of the same journey rather than a separate destination.
 */
export function Onboarding({ onDone }: { onDone: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  const last = index === SLIDES.length - 1;

  const goTo = (next: number) => {
    const clamped = Math.max(0, Math.min(SLIDES.length - 1, next));
    setIndex(clamped);
    scrollRef.current?.scrollTo({ x: clamped * width, animated: true });
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable
          onPress={onDone}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Skip the introduction"
          style={({ pressed }) => pressed && { opacity: 0.6 }}>
          <Text variant="captionStrong" color="textFaint">
            {last ? '' : 'Skip'}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) =>
          setIndex(Math.round(event.nativeEvent.contentOffset.x / width))
        }>
        {SLIDES.map((slide) => (
          <ScrollView
            key={slide.key}
            style={{ width }}
            contentContainerStyle={styles.slide}
            showsVerticalScrollIndicator={false}>
            <View style={[styles.art, { backgroundColor: theme.primarySoft }]}>
              <slide.Art size={slide.points ? 40 : 54} color={theme.primaryDeep} />
            </View>
            <Animated.View entering={FadeIn.duration(320)} style={styles.copy}>
              <Text variant="micro" color="textFaint">
                {slide.overline}
              </Text>
              <Text variant="display">{slide.title}</Text>
              <Text variant="body" color="textSoft" style={styles.body}>
                {slide.body}
              </Text>
              {slide.points ? (
                <View style={styles.points}>
                  {slide.points.map((point) => (
                    <View key={point.label} style={styles.point}>
                      <View style={[styles.pointIcon, { backgroundColor: theme.surfaceAlt }]}>
                        <Ionicons name={point.icon} size={16} color={theme.primaryDeep} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text variant="captionStrong">{point.label}</Text>
                        <Text variant="caption" color="textFaint">{point.detail}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
            </Animated.View>
          </ScrollView>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <View style={styles.dots}>
          {SLIDES.map((slide, i) => (
            <View
              key={slide.key}
              style={[
                styles.dot,
                {
                  backgroundColor: i === index ? theme.primary : theme.line,
                  width: i === index ? 20 : 7,
                },
              ]}
            />
          ))}
        </View>

        <Button
          full
          label={last ? 'Get started' : 'Next'}
          iconRight={
            <Ionicons name="arrow-forward" size={17} color={theme.onPrimary} />
          }
          onPress={() => (last ? onDone() : goTo(index + 1))}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.lg,
  },
  slide: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  points: { gap: Spacing.md, marginTop: Spacing.xs },
  point: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  pointIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  art: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { gap: Spacing.sm },
  body: { maxWidth: 380 },
  footer: { paddingHorizontal: Spacing.lg, gap: Spacing.lg },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  dot: { height: 7, borderRadius: 4 },
});
