import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { SCENE_PACKS } from '@/lib/scenes';

export default function ScenePicker() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={{ backgroundColor: theme.bg }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.md, paddingBottom: insets.bottom + Spacing.xl }}>
      <View style={{ gap: 6, marginBottom: Spacing.xs }}>
        <Text variant="micro" color="textFaint">OUR TAKE</Text>
        <Text variant="display">Pick a scene</Text>
        <Text variant="body" color="textSoft">
          Record a short video while you rank each moment. Choose a pack to start.
        </Text>
      </View>

      {SCENE_PACKS.map((pack, i) => (
        <Animated.View key={pack.id} entering={FadeInDown.duration(320).delay(i * 60)}>
          <Card padded elevation="soft" onPress={() => router.push(`/play/scene?pack=${pack.id}`)}>
            <View style={styles.head}>
              <View style={{ flex: 1 }}>
                <Text variant="title" style={{ fontSize: 19 }}>{pack.theme}</Text>
                <Text variant="caption" color="textSoft" style={{ marginTop: 3 }}>
                  {pack.prompt}
                </Text>
              </View>
              <View style={[styles.count, { backgroundColor: theme.surfaceAlt }]}>
                <Ionicons name="videocam-outline" size={14} color={theme.textSoft} />
                <Text variant="micro" color="textSoft">{pack.scenarios.length}</Text>
              </View>
            </View>
            <View style={styles.emojiRow}>
              {pack.scenarios.map((s) => (
                <Text key={s.id} style={styles.emoji}>{s.emoji}</Text>
              ))}
            </View>
          </Card>
        </Animated.View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  count: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill },
  emojiRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.base },
  emoji: { fontSize: 22 },
});
