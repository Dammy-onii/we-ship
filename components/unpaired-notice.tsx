import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Button } from './ui/button';
import { Text } from './ui/text';

/**
 * Lines shown to someone who has not paired yet.
 *
 * Light, and pointed at the app rather than the person. "Table for one" is a
 * joke about a booking; "you must be lonely" is a joke about the reader, and
 * this screen is the first thing a new account sees. Nothing here assumes why
 * they are unpaired — waiting on a partner to install, testing the app, and
 * single are all the same state to us, and only one of them is funny.
 */
const LINES = [
  'Table for one, for now.',
  'Your streak is currently a solo sport.',
  'All this space, and it is all yours.',
  'A shared space with excellent availability.',
  'Currently a party of one. The invite is open.',
];

/**
 * Stable for the day rather than per render.
 *
 * A line that changed on every re-render would flicker while scrolling, and one
 * that never changed would get old on the second launch.
 */
function lineForToday() {
  return LINES[Math.floor(Date.now() / 86_400_000) % LINES.length];
}

/**
 * What a partner-shaped surface says when there is no partner.
 *
 * Deliberately not a wall. Everything that does not need two people — friends,
 * your profile, notifications, notes — keeps working behind this, so it sits
 * *above* the real content rather than replacing it.
 */
export function UnpairedNotice({
  title,
  detail,
  compact = false,
}: {
  title: string;
  detail: string;
  /** Drops the button, for surfaces that already offer pairing elsewhere. */
  compact?: boolean;
}) {
  const theme = useTheme();
  const router = useRouter();

  return (
    <View style={[styles.root, { backgroundColor: theme.primarySoft }]}>
      <View style={styles.head}>
        <View style={[styles.mark, { backgroundColor: theme.surface }]}>
          <Ionicons name="heart-outline" size={18} color={theme.primaryDeep} />
        </View>
        <View style={styles.headText}>
          <Text variant="captionStrong" color="primaryDeep">
            {lineForToday()}
          </Text>
          <Text variant="title">{title}</Text>
        </View>
      </View>

      <Text variant="caption" color="textSoft">
        {detail}
      </Text>

      {compact ? null : (
        <Button
          full
          label="Pair with someone"
          icon={<Ionicons name="link-outline" size={17} color={theme.onPrimary} />}
          onPress={() => router.push('/pairing')}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderRadius: Radius.card, padding: Spacing.base, gap: Spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  mark: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headText: { flex: 1, minWidth: 0, gap: 2 },
});
