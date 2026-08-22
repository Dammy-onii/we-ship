import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Text } from './text';

type Props = {
  label: string;
  icon?: React.ReactNode;
  selected?: boolean;
  onPress?: () => void;
  tone?: 'primary' | 'partner' | 'accent';
  style?: ViewStyle;
};

/** Soft rounded tag / toggle chip. */
export function Pill({ label, icon, selected, onPress, tone = 'primary', style }: Props) {
  const theme = useTheme();
  const base = theme[tone];
  const content = (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: selected ? base : theme.surfaceAlt,
          borderColor: selected ? base : theme.line,
        },
        style,
      ]}>
      {icon}
      <Text
        variant="caption"
        style={{ color: selected ? theme.onPrimary : theme.textSoft, fontWeight: '600' }}>
        {label}
      </Text>
    </View>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.8 }}>
        {content}
      </Pressable>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: Spacing.base,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
