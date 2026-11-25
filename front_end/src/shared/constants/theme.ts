/**
 * Design tokens for the whole app, copied from the Figma spec (data/figma/figma_spec_json).
 *
 * Every color, size and font used by a component or screen must come from this file.
 * If you need a value that isn't here, add a token here first instead of typing the number in a style.
 *
 * Sizes are "logical units": the same number means points on iOS, dp on Android and px in the browser.
 */

import '@/shared/global.css';

import { Platform } from 'react-native';

// ---------- Colors ----------
// Light colors come from the Figma design. The dark colors were proposed in the spec and still
// need design approval (see FRONTEND_TASKS.md).
const lightColors = {
  text: '#282329',
  textSecondary: '#746D72',
  background: '#F9F7F3',
  backgroundElement: '#FFFFFF',
  backgroundSelected: '#EEE7E8',
  primary: '#651E3B',
  onPrimary: '#FFFFFF',
  border: '#D8D0D4',
  success: '#416447',
  successBackground: '#E5EDE4',
  warning: '#8E6D32',
  danger: '#B4233B',
  accentBackground: '#F0DCA9',
  brandAccent: '#F3C96B',
  technologyBackground: '#E9E2F0',
  outdoorsBackground: '#E1E8D8',
  artsBackground: '#F1DECE',
  mapGround: '#E9EDDF',
  mapBuilding: '#D9CEBD',
  mapBuildingText: '#514B44',
  mapPark: '#BDCAA7',
};

// `typeof lightColors` makes TypeScript complain if dark mode is missing a color that light mode has.
const darkColors: typeof lightColors = {
  text: '#F9F7F3',
  textSecondary: '#C0B7BD',
  background: '#191619',
  backgroundElement: '#272227',
  backgroundSelected: '#44313B',
  primary: '#E6AEC4',
  onPrimary: '#351020',
  border: '#5C515A',
  success: '#A8CBAE',
  successBackground: '#263C2C',
  warning: '#E2C181',
  danger: '#FFACB8',
  accentBackground: '#4D3C20',
  brandAccent: '#F3C96B',
  technologyBackground: '#3B3048',
  outdoorsBackground: '#303E29',
  artsBackground: '#49362C',
  mapGround: '#293125',
  mapBuilding: '#514B41',
  mapBuildingText: '#F1E8DB',
  mapPark: '#465738',
};

export const Colors = {
  light: lightColors,
  dark: darkColors,
};

// The name of any color above, e.g. 'primary' or 'textSecondary'.
export type ThemeColor = keyof typeof lightColors;

// ---------- Spacing (padding, margin, gap) ----------
export const Spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  hero: 64,
} as const;

// ---------- Corner radius ----------
export const Radius = {
  none: 0,
  mapBuilding: 6,
  control: 12,
  dateCell: 14,
  card: 16,
  hero: 22,
  map: 24,
  pill: 999, // any number bigger than half the height gives fully rounded ends
} as const;

// ---------- Border widths ----------
// The matching border colors are: default = 'border', focus = 'primary', error = 'danger'.
export const BorderWidth = {
  none: 0,
  default: 1,
  focus: 2,
  error: 1,
  eventAccent: 3,
} as const;

// ---------- Opacity ----------
export const Opacity = {
  default: 1,
  pressed: 0.8,
  disabled: 0.4,
  skeleton: 0.35,
} as const;

// ---------- Fixed sizes ----------
export const Size = {
  referencePhoneWidth: 390,
  // Widest the content gets on big screens (browser, tablets). See Screen's `width` prop.
  // The spec only defined the 480 form width; the reading and wide widths and the sidebar are
  // our own additions for a better web experience (not in Figma yet).
  formMaxWidth: 480, // forms and short flows (the spec's browserContentMaxWidth)
  readingMaxWidth: 760, // single-column screens like Schedule and Settings
  wideMaxWidth: 1100, // screens with two columns or a grid like Home, Map and Clubs
  sidebarWidth: 240, // the navigation sidebar on wide screens
  touchTargetMin: 48,
  buttonMinHeight: 54,
  inputMinHeight: 56,
  actionRowMinHeight: 80,
  organizationRowMinHeight: 88,
  eventCardMinHeight: 96,
  dateCellMinHeight: 70,
  tabBarMinHeight: 70,
  tabIconPillWidth: 48, // not in the spec; measured from the selected tab in Figma
  tabIconPillHeight: 30, // not in the spec; measured from the selected tab in Figma
  badge: 44,
  successEmblem: 84,
  icon: 24,
  iconSmall: 20,
  mapRouteStroke: 4,
  mapMarker: 28, // not in the spec; measured from the "L" marker in Figma
  mapOriginDot: 20, // not in the spec; measured from the green dot in Figma
  mapOriginDotCenter: 8, // not in the spec; the white center of the green dot
  mapNorthIcon: 12, // not in the spec; the arrow in the "N" badge
  // Loading placeholders: roughly the height of the content they stand in for.
  skeletonHeroHeight: 150,
  skeletonCardHeight: 110,
} as const;

// ---------- Screen-width breakpoints ----------
// At this window width and wider, the app switches from the phone layout (bottom tabs, one column)
// to the wide layout (sidebar, two columns). Use the useIsWideScreen() hook to check it.
export const Breakpoints = {
  wide: 768,
} as const;

// ---------- Ratios ----------
export const Ratio = {
  mapWidthToHeight: 1.046,
} as const;

// ---------- Animation durations (milliseconds) ----------
export const Motion = {
  feedbackMs: 100,
  screenTransitionMs: 200,
} as const;

// ---------- Fonts ----------
// The design uses Inter. Phones use the system font (San Francisco / Roboto) until Inter is
// added to the app (see FRONTEND_TASKS.md). In the browser, global.css tries Inter first.
export const Fonts = {
  sans: Platform.select({ web: 'var(--font-display)', default: undefined }),
};

// One entry per text style in the design. Use them through ThemedText: <ThemedText type="title">.
export const TextStyles = {
  logo: { fontFamily: Fonts.sans, fontSize: 86, fontWeight: 700, lineHeight: 96 },
  welcomeTitle: { fontFamily: Fonts.sans, fontSize: 39, fontWeight: 700, lineHeight: 46 },
  title: { fontFamily: Fonts.sans, fontSize: 28, fontWeight: 700, lineHeight: 34 },
  hero: { fontFamily: Fonts.sans, fontSize: 25, fontWeight: 700, lineHeight: 30 },
  subtitle: { fontFamily: Fonts.sans, fontSize: 19, fontWeight: 700, lineHeight: 24 },
  cardTitle: { fontFamily: Fonts.sans, fontSize: 18, fontWeight: 700, lineHeight: 24 },
  rowTitle: { fontFamily: Fonts.sans, fontSize: 15, fontWeight: 600, lineHeight: 20 },
  body: { fontFamily: Fonts.sans, fontSize: 14, fontWeight: 400, lineHeight: 20 },
  bodyBold: { fontFamily: Fonts.sans, fontSize: 14, fontWeight: 600, lineHeight: 20 },
  supporting: { fontFamily: Fonts.sans, fontSize: 13, fontWeight: 400, lineHeight: 18 },
  caption: { fontFamily: Fonts.sans, fontSize: 12, fontWeight: 400, lineHeight: 16 },
  button: { fontFamily: Fonts.sans, fontSize: 14, fontWeight: 600, lineHeight: 20 },
  eyebrow: { fontFamily: Fonts.sans, fontSize: 10, fontWeight: 700, lineHeight: 14 },
  tabLabel: { fontFamily: Fonts.sans, fontSize: 10, fontWeight: 500, lineHeight: 14 },
  dateNumber: { fontFamily: Fonts.sans, fontSize: 20, fontWeight: 500, lineHeight: 26 },
} as const;

// The name of any text style above, e.g. 'title' or 'caption'.
export type TextStyleName = keyof typeof TextStyles;
