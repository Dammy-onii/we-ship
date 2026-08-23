import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Text } from './text';

type Variant = 'filled' | 'soft' | 'ghost' | 'light';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  tone?: 'primary' | 'partner';
  icon?: React.ReactNode;
  /** Trailing icon — use for forward/continue actions. */
  iconRight?: React.ReactNode;
  disabled?: boolean;
  /**
   * Shows a spinner in place of the leading icon and blocks further presses.
   *
   * A button whose work takes a moment and gives no sign of it reads as a
   * button that did nothing, and gets pressed again.
   */
  loading?: boolean;
  style?: ViewStyle;
  full?: boolean;
  size?: 'md' | 'sm';
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Pill button with a spring press and a light haptic. */
export function Button({
  label,
  onPress,
  variant = 'filled',
  tone = 'primary',
  icon,
  iconRight,
  disabled: disabledProp,
  loading = false,
  style,
  full,
  size = 'md',
}: Props) {
  const theme = useTheme();
  // Loading implies disabled: the press is already in flight.
  const disabled = disabledProp || loading;
  const scale = useSharedValue(1);
  const base = tone === 'primary' ? theme.primary : theme.partner;
  const soft = tone === 'primary' ? theme.primarySoft : theme.partnerSoft;

  // Disabled controls get an explicitly inert fill rather than a faded copy of
  // the enabled style — dimming a filled button just made every action look off.
  const bg = disabled
    ? theme.disabledBg
    : variant === 'filled'
      ? base
      : variant === 'soft'
        ? soft
        : variant === 'light'
          ? theme.surface
          : 'transparent';
  const fg = disabled
    ? theme.disabledText
    : variant === 'filled'
      ? theme.onPrimary
      : variant === 'light'
        ? theme.text
        : base;

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  const handle = () => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress?.();
  };

  return (
    <AnimatedPressable
      accessibilityRole="button"
      onPress={handle}
      disabled={disabled}
      onPressIn={() => {
        scale.set(withSpring(0.96, { damping: 20, stiffness: 300 }));
      }}
      onPressOut={() => {
        scale.set(withSpring(1, { damping: 16, stiffness: 220 }));
      }}
      style={[
        styles.btn,
        size === 'sm' && styles.sm,
        { backgroundColor: bg },
        full && { alignSelf: 'stretch' },
        variant === 'ghost' && !disabled && { borderWidth: 1.2, borderColor: base + '55' },
        variant === 'filled' && !disabled && Shadow.subtle,
        animStyle,
        style,
      ]}>
      <View style={styles.row}>
        {loading ? <ActivityIndicator size="small" color={fg} /> : icon}
        <Text style={[size === 'sm' ? Typography.captionStrong : Typography.bodyStrong, { color: fg }]}>
          {label}
        </Text>
        {iconRight}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 52,
    borderRadius: Radius.pill,
    paddingVertical: 15,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sm: { minHeight: 44, paddingVertical: 10, paddingHorizontal: Spacing.base },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
