/**
 * Weship design tokens — calm · close · neutral.
 *
 * Visual direction: warm paper and graphite. An editorial serif (Fraunces)
 * carries the voice, Inter handles UI, and photography sits under neutral
 * scrims. Botanical line art remains an illustration style, not a green tint.
 * See docs/DESIGN.md.
 */

/** Type families — loaded in app/_layout.tsx. */
export const Font = {
  /** Fraunces — warm editorial serif. Display voice. */
  displayRegular: 'Fraunces_400Regular',
  displayMedium: 'Fraunces_500Medium',
  displaySemi: 'Fraunces_600SemiBold',
  displayBold: 'Fraunces_700Bold',
  /** Inter — UI sans. */
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemi: 'Inter_600SemiBold',
  sansBold: 'Inter_700Bold',
} as const;

export const Palette = {
  light: {
    // grounds
    bg: '#F6F3EE',
    bgDeep: '#ECE8E1',
    surface: '#FCFAF7',
    surfaceAlt: '#F0ECE6',
    surfaceSunk: '#E8E3DC',
    systemBar: '#ECE9E4',
    // ink
    text: '#262625',
    textSoft: '#5F5D59',
    textFaint: '#8A8781',
    line: '#E2DDD6',
    lineStrong: '#D1CAC1',
    // voices
    // Actions use warm umber, clearly distinct from the grey disabled state.
    primary: '#704936',
    primaryDeep: '#4B2F24',
    primarySoft: '#E9DDD6',
    onPrimary: '#FCFAF7',
    /** Fill for genuinely disabled controls — clearly inert, never mistaken for enabled. */
    disabledBg: '#E6E2DB',
    disabledText: '#A6A29B',
    partner: '#A8765C',
    partnerSoft: '#EEE0D8',
    // accents
    accent: '#7B838A',
    sky: '#9AAAB3',
    bloom: '#B97E82',
    gold: '#B79358',
    success: '#6F846F',
    // scrim over photography
    scrim: 'rgba(24,32,27,0.55)',
    /** Ground behind the Home hero before the pair has shared any imagery. */
    heroEmpty: '#4A423B',
    /**
     * The empty hero cycles through these rather than holding one flat colour.
     *
     * Every entry is deep enough that the light presence text above keeps the
     * treatment it has over a photograph, so the hero does not change character
     * the moment the pair's first photo arrives.
     */
    // Matched to within 2% relative luminance of each other on purpose: the
    // hero drifts in hue while its brightness holds steady, so the transition
    // reads as one ground shifting rather than the screen pulsing.
    heroEmptyCycle: ['#4A423B', '#45433E', '#4E4038', '#404441', '#4E4037'],
    // template-compat keys
    tint: '#704936',
    icon: '#5F5D59',
    background: '#F6F3EE',
    tabIconDefault: '#8A8781',
    tabIconSelected: '#704936',
  },
  dark: {
    bg: '#161616',
    bgDeep: '#101010',
    surface: '#202020',
    surfaceAlt: '#292929',
    surfaceSunk: '#303030',
    systemBar: '#161616',
    text: '#F0EEE9',
    textSoft: '#B8B4AD',
    textFaint: '#85827D',
    line: '#343434',
    lineStrong: '#44413D',
    primary: '#E0B09A',
    primaryDeep: '#F2C8B4',
    primarySoft: '#3B2E29',
    onPrimary: '#251812',
    disabledBg: '#2C2B29',
    disabledText: '#6E6B66',
    partner: '#D0A08A',
    partnerSoft: '#3A302B',
    accent: '#9CA4AA',
    sky: '#9AAAB3',
    bloom: '#C88E92',
    gold: '#C5A66C',
    success: '#88A088',
    scrim: 'rgba(8,8,8,0.62)',
    /** Ground behind the Home hero before the pair has shared any imagery. */
    heroEmpty: '#2A2622',
    /** See the note on the light palette. */
    heroEmptyCycle: ['#2A2622', '#262724', '#2D2521', '#242825', '#2E2520'],
    tint: '#B8B5AF',
    icon: '#B8B4AD',
    background: '#161616',
    tabIconDefault: '#85827D',
    tabIconSelected: '#F0EEE9',
  },
};

export type ColorScheme = keyof typeof Palette;
export type ThemeColors = (typeof Palette)['light'];

/** Temporarily pinned while the dark appearance is being redesigned. */
export const AppColorScheme: ColorScheme = 'light';

/** Gradient stops for signature surfaces. */
export const Gradients = {
  dawn: ['#F6F3EE', '#EFECE7', '#E5E2DD'] as const,
  dusk: ['#232323', '#1C1C1C', '#161616'] as const,
  meadow: ['#EBE8E2', '#D9D5CE', '#CBC5BD'] as const,
  meadowNight: ['#2C2B29', '#222220'] as const,
  sky: ['#CBDEE4', '#9DBCC7'] as const,
  clay: ['#F0DECF', '#DCB393'] as const,
  plum: ['#C3A0C6', '#8E6E9C'] as const,
  /** Warm scrim laid over photography, top→bottom. Weighted to the lower half. */
  photoScrim: [
    'rgba(18,17,16,0)',
    'rgba(18,17,16,0.28)',
    'rgba(18,17,16,0.66)',
    'rgba(18,17,16,0.9)',
  ] as const,
  /** Matching stop positions for `photoScrim`. */
  photoScrimStops: [0, 0.4, 0.72, 1] as const,
  /** Short scrim under a translucent top bar. */
  topScrim: ['rgba(18,17,16,0.45)', 'rgba(18,17,16,0)'] as const,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 56,
} as const;

export const Radius = {
  chip: 14,
  inset: 18,
  tile: 22,
  card: 28,
  hero: 34,
  pill: 999,
} as const;

/**
 * Type scale. Display sizes use Fraunces; UI sizes use Inter.
 * Line heights are generous — the app should feel unhurried.
 */
export const Typography = {
  hero: { fontSize: 34, lineHeight: 40, fontFamily: Font.displaySemi, letterSpacing: -0.6 },
  display: { fontSize: 27, lineHeight: 34, fontFamily: Font.displaySemi, letterSpacing: -0.4 },
  title: { fontSize: 21, lineHeight: 28, fontFamily: Font.displaySemi, letterSpacing: -0.2 },
  serif: { fontSize: 17, lineHeight: 26, fontFamily: Font.displayRegular },
  heading: { fontSize: 16, lineHeight: 22, fontFamily: Font.sansSemi, letterSpacing: -0.1 },
  body: { fontSize: 15, lineHeight: 23, fontFamily: Font.sans },
  bodyStrong: { fontSize: 15, lineHeight: 23, fontFamily: Font.sansMedium },
  caption: { fontSize: 13, lineHeight: 19, fontFamily: Font.sans },
  captionStrong: { fontSize: 13, lineHeight: 19, fontFamily: Font.sansMedium },
  micro: { fontSize: 11, lineHeight: 14, fontFamily: Font.sansSemi, letterSpacing: 0.9 },
} as const;

/** Layered elevation — cards lift softly, heroes lift further. */
export const Shadow = {
  subtle: {
    shadowColor: '#2A2416',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  soft: {
    shadowColor: '#2A2416',
    shadowOpacity: 0.08,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  lifted: {
    shadowColor: '#2A2416',
    shadowOpacity: 0.14,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: 16 },
    elevation: 9,
  },
} as const;

/** Legacy aliases kept for the Expo template components. */
export const Colors = Palette;
export const Fonts = {
  sans: Font.sans,
  serif: Font.displayRegular,
  rounded: Font.displaySemi,
  mono: 'monospace',
};
