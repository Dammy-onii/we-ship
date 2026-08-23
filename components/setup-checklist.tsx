import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSetupStatus } from '@/lib/use-setup-status';

/**
 * What is left to set up, and where to do it.
 *
 * Nothing previously told a new account what it was supposed to do next. The
 * card removes itself once everything is done, so it never becomes furniture.
 */
export function SetupChecklist() {
  const theme = useTheme();
  const router = useRouter();
  const { steps, pending } = useSetupStatus();

  if (!pending.length) return null;

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
      <View style={styles.head}>
        <Text variant="micro" color="textFaint">GETTING SET UP</Text>
        <Text variant="micro" color="textFaint">
          {steps.length - pending.length}/{steps.length}
        </Text>
      </View>
      <Text variant="title">
        {pending.length === 1 ? 'One thing left' : 'A few things left'}
      </Text>

      {pending.map((step) => (
        <Pressable
          key={step.key}
          onPress={() => router.push(step.href)}
          accessibilityRole="button"
          accessibilityLabel={step.label}
          style={({ pressed }) => [styles.step, pressed && { opacity: 0.6 }]}>
          <View style={[styles.stepIcon, { backgroundColor: theme.surfaceAlt }]}>
            <Ionicons name={step.icon} size={17} color={theme.primaryDeep} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">{step.label}</Text>
            <Text variant="caption" color="textFaint">{step.detail}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.textFaint} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.base,
    gap: Spacing.xs,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  step: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
  stepIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
