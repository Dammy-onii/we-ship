import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getLastTake, rankedOrder } from '@/lib/scene-take';
import { getScenePack } from '@/lib/scenes';

export default function SceneResultScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const take = getLastTake();
  const close = () => router.dismissAll?.() ?? router.back();

  // Loop the captured clip quietly behind the ranking.
  const player = useVideoPlayer(take?.videoUri ?? null, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  // No take in memory (e.g. opened via deep link) — nothing to show.
  useEffect(() => {
    if (!take) router.replace('/play');
  }, [take, router]);
  if (!take) return null;

  const pack = getScenePack(take.packId);
  const byId = Object.fromEntries(pack.scenarios.map((s) => [s.id, s]));
  const order = rankedOrder(take).filter((id) => byId[id]);
  const hasVideo = Boolean(take.videoUri);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {/* Playback hero with the ranking overlaid on the replay */}
        <View style={[styles.hero, { paddingTop: insets.top }]}>
          {hasVideo ? (
            <VideoView
              player={player}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              nativeControls={false}
            />
          ) : (
            <LinearGradient colors={['#3A4A44', '#232C2A', '#1A211F']} style={StyleSheet.absoluteFill} />
          )}
          <LinearGradient
            colors={['rgba(16,20,17,0.28)', 'rgba(16,20,17,0.02)', 'rgba(16,20,17,0.48)']}
            locations={[0, 0.4, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          <View style={styles.heroTop}>
            <Pressable onPress={close} hitSlop={10} style={styles.iconBtn} accessibilityLabel="Close">
              <Ionicons name="close" size={22} color="#FFFCF7" />
            </Pressable>
            <View style={styles.tag}>
              <Ionicons name="film-outline" size={14} color="#FFFCF7" />
              <Text variant="micro" onPhoto>
                {hasVideo ? 'YOUR TAKE' : 'RANKING'}
              </Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.heroBottom}>
            <Text variant="micro" onPhoto style={{ opacity: 0.85 }}>
              {pack.theme.toUpperCase()}
            </Text>
            <Text variant="display" onPhoto>
              How you ranked it
            </Text>
          </View>
        </View>

        <View style={{ padding: Spacing.lg, gap: Spacing.md }}>
          {!hasVideo && (
            <View style={[styles.note, { backgroundColor: theme.surfaceAlt }]}>
              <Ionicons name="information-circle-outline" size={16} color={theme.textSoft} />
              <Text variant="caption" color="textSoft" style={{ flex: 1 }}>
                {take.simulated
                  ? 'Recording isn’t available here, so this take is ranking-only. On a device the clip is captured live.'
                  : 'This take has no clip attached.'}
              </Text>
            </View>
          )}

          <Card padded elevation="soft" style={{ gap: Spacing.md }}>
            {order.map((id, i) => (
              <Animated.View key={id} entering={FadeInDown.duration(300).delay(i * 55)}>
                <View style={styles.row}>
                  <View style={[styles.rankChip, { backgroundColor: theme.primary }]}>
                    <Text variant="captionStrong" style={{ color: theme.onPrimary }}>
                      {i + 1}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 20 }}>{byId[id].emoji}</Text>
                  <Text variant="bodyStrong" style={{ flex: 1 }}>
                    {byId[id].label}
                  </Text>
                </View>
              </Animated.View>
            ))}
          </Card>

          <View style={[styles.compareHint, { borderColor: theme.line }]}>
            <Ionicons name="people-outline" size={17} color={theme.textSoft} />
            <Text variant="caption" color="textSoft" style={{ flex: 1 }}>
              Send this to your partner so they can record their own — comparing both takes side by
              side is coming with live sync.
            </Text>
          </View>

          <View style={{ gap: Spacing.sm, marginTop: Spacing.sm }}>
            {/* Export with the overlay burned in is not built yet. */}
            <Button
              full
              variant="soft"
              label="Saving coming soon"
              icon={<Ionicons name="time-outline" size={16} color={theme.primaryDeep} />}
              disabled
            />
            <Button full variant="ghost" label="Done" onPress={close} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { height: 420, justifyContent: 'space-between', overflow: 'hidden' },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroBottom: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl, gap: 2 },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.inset,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  rankChip: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  compareHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.inset,
  },
});
