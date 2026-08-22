import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, View, type ViewStyle } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Text } from './text';

type Props = {
  title: string;
  detail?: string;
  loading?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  compact?: boolean;
  style?: ViewStyle;
};

/** Shared loading/empty/error placeholder for data-backed surfaces. */
export function DataState({ title, detail, loading = false, icon = 'sparkles-outline', compact = false, style }: Props) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole={loading ? 'progressbar' : undefined}
      style={[styles.root, compact && styles.compact, style]}>
      {loading
        ? <ActivityIndicator color={theme.primary} />
        : <Ionicons name={icon} size={compact ? 24 : 30} color={theme.textFaint} />}
      <Text variant="bodyStrong" center>{title}</Text>
      {detail ? <Text variant="caption" color="textFaint" center>{detail}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing['2xl'], paddingHorizontal: Spacing.lg },
  compact: { paddingVertical: Spacing.lg },
});
