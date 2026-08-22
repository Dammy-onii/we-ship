import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useLayoutEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bloom, Sprig, UsMark } from '@/components/art/botanicals';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const WYR: [string, string][] = [
  ['A weekend with zero plans', 'A weekend packed with adventure'],
  ['Always know what the other is thinking', 'Always feel what the other feels'],
  ['Sunrise together every day', 'Stay up for every sunset'],
  ['A tiny home by the sea', 'A cabin in the mountains'],
  ['Re-live our first date', 'Fast-forward to our next trip'],
  ['Breakfast in bed', 'Midnight snack run'],
];

const TOD = {
  truth: [
    'What’s a moment with me you replay in your head?',
    'When did you first know?',
    'What’s something small you wish I did more?',
    'What’s a tiny thing about me you’d never change?',
  ],
  dare: [
    'Send a voice note singing our song.',
    'Text me the last photo in your camera roll.',
    'Describe me using only three words.',
    'Do your best impression of me right now.',
  ],
};

export default function GameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const title = id === 'wyr' ? 'Would you rather' : id === 'tod' ? 'Truth or dare' : 'Play';

  useLayoutEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);

  if (id === 'wyr') return <WouldYouRather />;
  if (id === 'tod') return <TruthOrDare />;
  return <ComingSoon />;
}

function ComingSoon() {
  const theme = useTheme();
  return (
    <View style={styles.center}>
      <Sprig size={54} color={theme.primary} opacity={0.5} />
      <Text variant="title">Coming soon</Text>
      <Text variant="caption" color="textFaint" center>
        This one’s still growing.
      </Text>
    </View>
  );
}

function WouldYouRather() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<0 | 1 | null>(null);
  const pair = WYR[i % WYR.length];

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom + Spacing.lg }]}>
      <View style={styles.gameHead}>
        <UsMark size={22} color={theme.primary} />
        <Text variant="micro" color="textFaint">
          ROUND {i + 1} · TAP THE ONE YOU’D PICK
        </Text>
      </View>

      <View style={styles.options}>
        <Option label={pair[0]} on={picked === 0} onPress={() => setPicked(0)} delay={0} />
        <View style={styles.orRow}>
          <View style={[styles.orLine, { backgroundColor: theme.line }]} />
          <Text variant="micro" color="textFaint">
            OR
          </Text>
          <View style={[styles.orLine, { backgroundColor: theme.line }]} />
        </View>
        <Option label={pair[1]} on={picked === 1} onPress={() => setPicked(1)} delay={70} />
      </View>

      <Button
        full
        label="Next round"
        iconRight={<Ionicons name="arrow-forward" size={16} color={theme.onPrimary} />}
        onPress={() => {
          setPicked(null);
          setI((n) => n + 1);
        }}
      />
    </View>
  );
}

function Option({
  label,
  on,
  onPress,
  delay,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
  delay: number;
}) {
  const theme = useTheme();
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(340)}>
      <Pressable onPress={onPress}>
        <Card
          padded
          elevation={on ? 'soft' : 'subtle'}
          style={{
            minHeight: 132,
            justifyContent: 'center',
            paddingVertical: Spacing.xl,
            borderColor: on ? theme.primary : theme.line,
            borderWidth: on ? 1.5 : StyleSheet.hairlineWidth,
            backgroundColor: on ? theme.primarySoft : theme.surface,
          }}>
          <Text variant="title" center style={{ fontSize: 20, lineHeight: 28 }}>
            {label}
          </Text>
          {on && (
            <View style={styles.pickedTag}>
              <Ionicons name="checkmark-circle" size={15} color={theme.primaryDeep} />
              <Text variant="micro" color="primaryDeep">
                YOUR PICK
              </Text>
            </View>
          )}
        </Card>
      </Pressable>
    </Animated.View>
  );
}

function TruthOrDare() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'truth' | 'dare' | null>(null);
  const [idx, setIdx] = useState({ truth: 0, dare: 0 });

  const draw = (m: 'truth' | 'dare') => {
    setMode(m);
    setIdx((s) => ({ ...s, [m]: s[m] + 1 }));
  };

  const prompt = mode ? TOD[mode][idx[mode] % TOD[mode].length] : null;
  const accent = mode === 'dare' ? theme.partner : theme.primary;

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom + Spacing.lg }]}>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        {prompt ? (
          <Animated.View key={`${mode}-${idx[mode!]}`} entering={FadeIn.duration(320)}>
            <Card padded elevation="soft" style={{ minHeight: 230, justifyContent: 'center', gap: Spacing.lg }}>
              <View style={{ alignItems: 'center', gap: Spacing.sm }}>
                <View style={[styles.todBadge, { backgroundColor: accent + '1A' }]}>
                  {mode === 'dare' ? (
                    <Bloom size={22} color={accent} />
                  ) : (
                    <Sprig size={22} color={accent} />
                  )}
                </View>
                <Text variant="micro" color={mode === 'dare' ? 'partner' : 'primary'}>
                  {mode?.toUpperCase()}
                </Text>
              </View>
              <Text variant="title" center style={{ lineHeight: 30 }}>
                {prompt}
              </Text>
            </Card>
          </Animated.View>
        ) : (
          <View style={styles.center}>
            <Bloom size={54} color={theme.bloom} opacity={0.7} />
            <Text variant="title">Pick one</Text>
            <Text variant="caption" color="textFaint" center>
              Soft, sweet, just for the two of you.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.todBtns}>
        <Button full label="Truth" tone="primary" onPress={() => draw('truth')} style={{ flex: 1 }} />
        <Button full label="Dare" tone="partner" onPress={() => draw('dare')} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: Spacing.lg, gap: Spacing.base },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.lg },
  gameHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, justifyContent: 'center' },
  options: { flex: 1, gap: Spacing.md, justifyContent: 'center' },
  pickedTag: { flexDirection: 'row', alignItems: 'center', gap: 5, justifyContent: 'center', marginTop: Spacing.sm },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.xl },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth },
  todBadge: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  todBtns: { flexDirection: 'row', gap: Spacing.md },
});
