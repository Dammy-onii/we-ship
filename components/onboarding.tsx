import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bloom, Leaf, Sparkle } from '@/components/art/botanicals';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Slide = {
  key: string;
  overline: string;
  title: string;
  body: string;
  Art: (p: { size?: number; color?: string; opacity?: number }) => React.ReactElement;
};

/**
 * What someone needs to understand before they are asked for an email.
 *
 * Deliberately short and concrete: what the app is, what the two of you do in
 * it, and the one thing that is different about it (nothing is public, and it
 * only works once two people are joined).
 */
const SLIDES: Slide[] = [
  {
    key: 'space',
    overline: 'WELCOME TO WESHIP',
    title: 'A private space for two',
    body: 'Not a feed and not a group chat. One quiet place that only the two of you can see — photos, voice notes, and small things worth keeping.',
    Art: Leaf,
  },
  {
    key: 'daily',
    overline: 'EVERY DAY',
    title: 'Something small to share',
    body: 'A question a day, shared 2dos, and a streak that grows when you both show up. Enough to keep you close without becoming another chore.',
    Art: Sparkle,
  },
  {
    key: 'friends',
    overline: 'AND YOUR PEOPLE',
    title: 'Friends, kept separate',
    body: 'Connect with friends and see what they post on their board. Your shared space stays private — friends never see it.',
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
          <View key={slide.key} style={[styles.slide, { width }]}>
            <View style={[styles.art, { backgroundColor: theme.primarySoft }]}>
              <slide.Art size={54} color={theme.primaryDeep} />
            </View>
            <Animated.View entering={FadeIn.duration(320)} style={styles.copy}>
              <Text variant="micro" color="textFaint">
                {slide.overline}
              </Text>
              <Text variant="display">{slide.title}</Text>
              <Text variant="body" color="textSoft" style={styles.body}>
                {slide.body}
              </Text>
            </Animated.View>
          </View>
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
  slide: { flex: 1, paddingHorizontal: Spacing.lg, justifyContent: 'center', gap: Spacing.xl },
  art: {
    width: 108,
    height: 108,
    borderRadius: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { gap: Spacing.sm },
  body: { maxWidth: 380 },
  footer: { paddingHorizontal: Spacing.lg, gap: Spacing.lg },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  dot: { height: 7, borderRadius: 4 },
});
