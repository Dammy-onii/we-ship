import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  /** Soft dawn/dusk wash behind the top of the screen. */
  gradient?: boolean;
  /** Content runs to the very top (for full-bleed heroes). */
  edgeToEdge?: boolean;
  contentStyle?: ViewStyle;
  /**
   * Pinned to the screen rather than the content — for floating actions.
   *
   * Anything absolutely positioned *inside* `children` is positioned against
   * the scroll content, which is only as tall as it needs to be. A short page
   * would leave a "bottom-anchored" button floating in the middle of the view.
   */
  overlay?: ReactNode;
};

/** Screen container with the warm ground and room for the floating tab bar. */
export function Screen({
  children,
  scroll = true,
  gradient = false,
  edgeToEdge = false,
  contentStyle,
  overlay,
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const body = (
    <SafeAreaView edges={edgeToEdge ? [] : ['top']} style={contentStyle}>
      {children}
    </SafeAreaView>
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      {gradient && (
        // Ends on `theme.bg` exactly. The old fixed palette finished a few
        // shades darker than the page, so the gradient's bottom edge drew a
        // visible horizontal seam across the middle of every screen that read
        // as a grey panel laid over the top half.
        <LinearGradient
          colors={[theme.bgDeep, theme.bg]}
          style={styles.gradient}
          pointerEvents="none"
        />
      )}
      {scroll ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 116 }}>
          {body}
        </ScrollView>
      ) : (
        body
      )}
      {overlay}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  gradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 420 },
});
