// theme.ts: design tokens v2 ("sunrise") for the DOrSU student app (React Native)
// Fonts: npm i @expo-google-fonts/dm-sans, then load DMSans_400Regular, DMSans_500Medium, DMSans_700Bold

export const colors = {
  ink: '#14315C',
  blue: '#2563B8',
  blueDark: '#1E50A0',
  sky: '#DDEBFB',
  chip: '#EEF3FB',

  sun: '#FFC93C',
  sunSoft: '#FFEFB8',

  cream: '#FFF8E1',
  creamLine: '#F0E2AE',
  surface: '#FFFFFF',
  white: '#FFFFFF',

  muted: '#55657F',
  border: '#D9DFEA',
  disabledBg: '#F3F4F7',
  disabledText: '#6B7689',
  danger: '#D92D20',
} as const;

// Only these font sizes are allowed (10 to 16).
export const fontSize = { xxs: 10, xs: 11, sm: 12, md: 13, lg: 14, xl: 16 } as const;

export const fontFamily = {
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  bold: 'DMSans_700Bold',
} as const;

export const radius = 4; // inputs, chips, tiles, tab items, accents
export const buttonRadius = 16; // buttons only
export const cardRadius = 16; // cards only

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

export const sizes = {
  buttonHeight: 32,
  inputHeight: 44,
  iconButton: 24,
  tabIcon: 16,
  screenPadding: 16,
} as const;

// Use on every Pressable so 24px buttons stay easy to tap.
export const hitSlop = { top: 10, bottom: 10, left: 8, right: 8 } as const;

// Card look: flat white with a 1px cream line underneath.
export const cardShadow = {
  shadowColor: colors.ink,
  shadowOpacity: 0.06,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 3 },
  elevation: 1,
} as const;

export const theme = { colors, fontSize, fontFamily, radius, spacing, sizes, hitSlop, cardShadow };
export type Theme = typeof theme;
