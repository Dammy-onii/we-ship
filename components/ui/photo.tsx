import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { Gradients } from '@/constants/theme';

/**
 * Photography with a designed fallback.
 *
 * A gradient wash always paints underneath, so the layout still reads as
 * intentional if an image is slow or unavailable (standalone v1 has no
 * bundled media yet). A warm scrim keeps overlaid text legible and gives
 * arbitrary photography a consistent, on-brand tone.
 */

const WASHES: readonly (readonly [string, string])[] = [
  ['#E7DFCB', '#CBB893'],
  ['#DDE6D6', '#B3CBB0'],
  ['#E9D8D2', '#C9A79C'],
  ['#D6E1E4', '#A6C0C8'],
  ['#EADFC4', '#D3B583'],
  ['#DED8E6', '#B3A6C6'],
] as const;

type Props = {
  /** Exact local/remote URI. Takes precedence over placeholder imagery. */
  uri?: string;
  /** Stable seed → stable (but arbitrary) photo. */
  seed?: string;
  /** Curated photo id — preferred over `seed` so subject matter stays on-theme. */
  id?: number;
  width?: number;
  height?: number;
  /** Index into the fallback wash palette. */
  wash?: number;
  /** Darken the lower portion so text on top stays readable. */
  scrim?: boolean;
  style?: ViewStyle;
  children?: React.ReactNode;
};

export function Photo({ uri: exactUri, wash = 0, scrim, style, children }: Props) {
  const colors = WASHES[wash % WASHES.length];
  // Missing photography stays entirely on device as a branded gradient. Do
  // not send demo/game identifiers to a third-party placeholder service.
  const uri = exactUri ?? null;

  return (
    <View style={[styles.wrap, style]}>
      <LinearGradient colors={colors} style={StyleSheet.absoluteFill} />
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={420}
        />
      ) : null}
      {scrim && (
        <LinearGradient
          colors={Gradients.photoScrim}
          locations={Gradients.photoScrimStops}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
});
