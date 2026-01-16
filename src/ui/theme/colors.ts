/**
 * Midnight Slate Theme
 * Neutral surfaces with crisp blue + teal accents
 */

export const CatppuccinColors = {
  // Base colors
  base: '#0F1115',
  mantle: '#151821',
  crust: '#1B1F2A',

  // Surface colors
  surface0: '#1F2430',
  surface1: '#273044',
  surface2: '#303A52',

  // Overlay colors
  overlay0: '#3C465E',
  overlay1: '#55617A',
  overlay2: '#6C7890',

  // Text colors
  text: '#E6E9EF',
  subtext0: '#C0C7D4',
  subtext1: '#D3D8E2',

  // Accent colors
  blue: '#4F8CFF',
  lavender: '#7A8CFF',
  sapphire: '#5AC8FA',
  sky: '#6BD6E8',
  teal: '#5AD1B2',
  green: '#3CCB8C',
  yellow: '#F5B454',
  peach: '#F29A64',
  maroon: '#E76F7C',
  red: '#F26B6B',
  mauve: '#9B7AF6',
  pink: '#F28DD1',
  flamingo: '#F2B4A8',
  rosewater: '#F5D7C9',
};

// Semantic color mappings for easier usage
export const theme = {
  // Background colors
  background: {
    primary: CatppuccinColors.base,
    secondary: CatppuccinColors.mantle,
    tertiary: CatppuccinColors.crust,
    elevated: CatppuccinColors.surface0,
    elevatedHigh: CatppuccinColors.surface1,
  },

  // Text colors
  text: {
    primary: CatppuccinColors.text,
    secondary: CatppuccinColors.subtext1,
    tertiary: CatppuccinColors.subtext0,
    muted: CatppuccinColors.overlay2,
    disabled: CatppuccinColors.overlay1,
  },

  // Border colors
  border: {
    primary: CatppuccinColors.surface0,
    secondary: CatppuccinColors.surface1,
    focus: CatppuccinColors.blue,
  },

  // Accent colors for interactive elements
  accent: {
    primary: CatppuccinColors.blue,
    secondary: CatppuccinColors.lavender,
    success: CatppuccinColors.green,
    warning: CatppuccinColors.yellow,
    error: CatppuccinColors.red,
    info: CatppuccinColors.sapphire,
  },

  // Parent/tag colors (matching the existing ParentColor enum)
  parent: {
    red: CatppuccinColors.red,
    orange: CatppuccinColors.peach,
    yellow: CatppuccinColors.yellow,
    green: CatppuccinColors.green,
    blue: CatppuccinColors.blue,
    cyan: CatppuccinColors.sky,
    purple: CatppuccinColors.mauve,
  },

  // Card colors
  card: {
    background: CatppuccinColors.surface0,
    backgroundHover: CatppuccinColors.surface1,
    border: CatppuccinColors.surface1,
    shadow: '#000000',
  },

  // Input colors
  input: {
    background: CatppuccinColors.surface0,
    backgroundFocus: CatppuccinColors.surface1,
    border: CatppuccinColors.surface1,
    borderFocus: CatppuccinColors.blue,
    text: CatppuccinColors.text,
    placeholder: CatppuccinColors.overlay2,
  },

  // Button colors
  button: {
    primary: {
      background: CatppuccinColors.blue,
      text: CatppuccinColors.text,
    },
    secondary: {
      background: CatppuccinColors.surface1,
      text: CatppuccinColors.text,
    },
    danger: {
      background: CatppuccinColors.red,
      text: CatppuccinColors.text,
    },
    success: {
      background: CatppuccinColors.green,
      text: CatppuccinColors.text,
    },
  },

  // Badge colors
  badge: {
    background: CatppuccinColors.blue,
    text: CatppuccinColors.text,
  },

  // Header/navigation colors
  header: {
    background: CatppuccinColors.blue,
    text: CatppuccinColors.text,
  },

  // Modal/overlay colors
  modal: {
    background: CatppuccinColors.mantle,
    overlay: 'rgba(0, 0, 0, 0.7)',
  },

  // Glassmorphism
  glass: {
    background: 'rgba(21, 24, 33, 0.72)',
    border: 'rgba(255, 255, 255, 0.08)',
    highlight: 'rgba(255, 255, 255, 0.04)',
    tint: {
      blue: 'rgba(79, 140, 255, 0.14)',
      purple: 'rgba(122, 140, 255, 0.14)',
      neutral: 'rgba(39, 48, 68, 0.7)',
    },
    blur: 20,
  },
};

export default theme;
