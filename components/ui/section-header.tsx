import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { Text } from './text';

type Props = {
  overline?: string;
  title: string;
  action?: string;
  onAction?: () => void;
};

/** Small overline + serif title with generous space above. */
export function SectionHeader({ overline, title, action, onAction }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={{ flex: 1 }}>
        {overline ? (
          <Text variant="micro" color="textFaint" style={styles.overline}>
            {overline.toUpperCase()}
          </Text>
        ) : null}
        <Text variant="title">{title}</Text>
      </View>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text variant="captionStrong" color="primary">
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  overline: { marginBottom: 5 },
});
