import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Radius, Shadow, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  children: ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  padded?: boolean;
  tone?: 'surface' | 'alt' | 'sunk';
  elevation?: keyof typeof Shadow;
  /** Removes the border for cards sitting on artwork. */
  bare?: boolean;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Soft, layered card. Presses settle with a spring rather than snapping. */
export function Card({
  children,
  style,
  onPress,
  padded = true,
  tone = 'surface',
  elevation = 'soft',
  bare,
}: Props) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const bg = tone === 'surface' ? theme.surface : tone === 'alt' ? theme.surfaceAlt : theme.surfaceSunk;

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  const body = (
    <View
      style={[
        styles.card,
        { backgroundColor: bg, borderColor: bare ? 'transparent' : theme.line },
        bare && { borderWidth: 0 },
        padded && styles.padded,
        style,
      ]}>
      {children}
    </View>
  );

  if (!onPress) {
    return <View style={[Shadow[elevation], styles.radius]}>{body}</View>;
  }

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        scale.set(withSpring(0.975, { damping: 20, stiffness: 260 }));
      }}
      onPressOut={() => {
        scale.set(withSpring(1, { damping: 18, stiffness: 200 }));
      }}
      style={[Shadow[elevation], styles.radius, animStyle]}>
      {body}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  radius: { borderRadius: Radius.card },
  card: {
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  padded: { padding: Spacing.lg },
});
