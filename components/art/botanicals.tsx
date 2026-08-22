/**
 * Botanical line art — the app's illustration language.
 * Vector, theme-aware, and drawn to feel hand-made rather than iconographic.
 */
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import type { ColorValue } from 'react-native';

type ArtProps = { size?: number; color?: ColorValue; opacity?: number };

/** A small leafy sprig. Used as a quiet decorative mark. */
export function Sprig({ size = 64, color = '#696864', opacity = 1 }: ArtProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" opacity={opacity}>
      <G stroke={color} strokeWidth={1.6} fill="none" strokeLinecap="round">
        <Path d="M32 58 C32 40 32 24 32 8" />
        <Path d="M32 44 C24 42 19 36 18 28 C26 28 31 34 32 42" fill={color} fillOpacity={0.14} />
        <Path d="M32 34 C40 32 45 26 46 18 C38 18 33 24 32 32" fill={color} fillOpacity={0.14} />
        <Path d="M32 24 C25 22 21 17 20 10 C27 10 31 15 32 22" fill={color} fillOpacity={0.14} />
      </G>
    </Svg>
  );
}

/** A single rounded leaf. */
export function Leaf({ size = 28, color = '#696864', opacity = 1 }: ArtProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" opacity={opacity}>
      <Path
        d="M23 5 C23 16 16 23 5 23 C5 12 12 5 23 5 Z"
        fill={color}
        fillOpacity={0.18}
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Path d="M5 23 C10 18 16 12 21 7" stroke={color} strokeWidth={1.3} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

/** Two overlapping circles — the "us" mark. */
export function UsMark({ size = 28, color = '#696864', opacity = 1 }: ArtProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" opacity={opacity}>
      <Circle cx={11} cy={14} r={7.5} stroke={color} strokeWidth={1.6} fill={color} fillOpacity={0.12} />
      <Circle cx={17} cy={14} r={7.5} stroke={color} strokeWidth={1.6} fill={color} fillOpacity={0.12} />
    </Svg>
  );
}

/** A crescent moon with a small star. */
export function Moon({ size = 28, color = '#696864', opacity = 1 }: ArtProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" opacity={opacity}>
      <Path
        d="M20.5 17.8 A8.5 8.5 0 1 1 12.4 6.2 A6.8 6.8 0 0 0 20.5 17.8 Z"
        fill={color}
        fillOpacity={0.16}
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <Circle cx={21.5} cy={7.5} r={1.4} fill={color} />
    </Svg>
  );
}

/** A simple open bloom. */
export function Bloom({ size = 28, color = '#D2848A', opacity = 1 }: ArtProps) {
  const petals = [0, 72, 144, 216, 288];
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" opacity={opacity}>
      <G>
        {petals.map((deg) => (
          <Ellipse
            key={deg}
            cx={14}
            cy={7.6}
            rx={3.5}
            ry={6.1}
            fill={color}
            fillOpacity={0.2}
            stroke={color}
            strokeWidth={1.4}
            transform={`rotate(${deg} 14 14)`}
          />
        ))}
        <Circle cx={14} cy={14} r={2.6} fill={color} fillOpacity={0.55} />
      </G>
    </Svg>
  );
}

/** A tiny flame for streaks. */
export function Flame({ size = 24, color = '#CBA04E', opacity = 1 }: ArtProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" opacity={opacity}>
      <Path
        d="M12 2.5 C14.5 7 18.5 8.6 18.5 13.4 A6.5 6.5 0 0 1 5.5 13.4 C5.5 10.6 7.2 9.2 8.4 7.4 C9 9 10 9.6 10.8 9.6 C11.4 7.2 11.2 4.8 12 2.5 Z"
        fill={color}
        fillOpacity={0.28}
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** A layered hillside — used as a soft footer/ornament. */
export function Hills({ width = 320, height = 60, color = '#696864', opacity = 0.16 }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 320 60" opacity={opacity}>
      <Path d="M0 46 C50 26 92 52 140 38 C188 24 232 46 280 34 L320 28 L320 60 L0 60 Z" fill={color} />
      <Path
        d="M0 54 C60 40 110 60 168 48 C226 36 268 56 320 46 L320 60 L0 60 Z"
        fill={color}
        fillOpacity={0.7}
      />
    </Svg>
  );
}

/** A four-point spark with two smaller companions — the Spotlight mark. */
export function Sparkle({ size = 28, color = '#33312C', opacity = 1 }: ArtProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" opacity={opacity}>
      <G stroke={color} strokeWidth={1.5} strokeLinejoin="round" fill="none">
        <Path
          d="M15.4 5.2 C16.2 9.4 17.9 11.1 22.1 11.9 C17.9 12.7 16.2 14.4 15.4 18.6 C14.6 14.4 12.9 12.7 8.7 11.9 C12.9 11.1 14.6 9.4 15.4 5.2 Z"
          fill={color}
          fillOpacity={0.16}
        />
        <Path
          d="M7.6 16.4 C8 18.5 8.8 19.3 10.9 19.7 C8.8 20.1 8 20.9 7.6 23 C7.2 20.9 6.4 20.1 4.3 19.7 C6.4 19.3 7.2 18.5 7.6 16.4 Z"
          fill={color}
          fillOpacity={0.12}
        />
      </G>
    </Svg>
  );
}
