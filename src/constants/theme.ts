// src/constants/theme.ts
// Matches the Eco Pulse prototype design system exactly

export const Colors = {
  // Backgrounds
  bg: '#07100D',
  bg2: '#0E1A16',
  bg3: '#152119',
  sf: '#1B2B24',
  sf2: '#223830',

  // Accent
  lime: '#C8F45A',
  lime2: '#AADC3A',
  lime3: '#7BAF1A',

  // Status
  amber: '#FCD34D',
  coral: '#FB7185',
  teal: '#2DD4BF',
  sky: '#7DD3FC',

  // Text
  tx: '#F0FAF4',
  tx2: '#8FB5A0',
  tx3: '#4D7A64',

  // Borders
  border: 'rgba(200,244,90,0.1)',
  border2: 'rgba(200,244,90,0.22)',

  // Friends avatars
  friends: {
    alex: '#5BC8A8',
    maya: '#7DD3FC',
    tom: '#FCD34D',
    sara: '#FB923C',
    dan: '#FB7185',
  },
} as const;

export const Typography = {
  // Cabinet Grotesk — headings/labels
  heading: 'CabinetGrotesk-Black',
  headingBold: 'CabinetGrotesk-ExtraBold',
  headingMedium: 'CabinetGrotesk-Bold',

  // Instrument Sans — body
  body: 'InstrumentSans-Regular',
  bodyMedium: 'InstrumentSans-Medium',
  bodySemiBold: 'InstrumentSans-SemiBold',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,
} as const;

export const Shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  subtle: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
} as const;
