import { AppColorScheme, Palette, type ThemeColors } from '@/constants/theme';

/** Active nature palette for the current color scheme. */
export function useTheme(): ThemeColors {
  return Palette[AppColorScheme];
}

export function useIsDark(): boolean {
  return AppColorScheme === 'dark';
}
