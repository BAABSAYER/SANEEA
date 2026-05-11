/**
 * SUNAI (سنيع) — Brand Identity Tokens
 *
 * Logo: black Arabic calligraphy wordmark "سنيع" on transparent background.
 * Tagline: "نضبطها لك" (We'll set it up for you) rendered in forest green.
 *
 * Palette direction: Jet Black + Forest Green.
 * Black anchors the brand in the calligraphy ink aesthetic; forest green
 * signals growth, precision, and the Saudi event experience.
 *
 * This file is the single source of truth for all design decisions.
 * CSS variables in index.css must stay in sync with `cssVars` below.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Identity
// ─────────────────────────────────────────────────────────────────────────────

export const brandIdentity = {
  name: {
    latin:   'Sunai',
    arabic:  'سنيع',
  },
  tagline: {
    arabic:  'نضبطها لك',
    english: "We'll set it up for you",
  },
  platform: {
    name: 'SUNAI',
    description: 'Event Management Platform',
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Logo Assets
// ─────────────────────────────────────────────────────────────────────────────

export const brandLogos = {
  wordmark:       '/src/assets/logo.png',          // Primary: Arabic calligraphy wordmark PNG
  appIcon:        '/images/app_icon.png',
  favicon:        '/favicon.svg',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Raw Color Palette
// ─────────────────────────────────────────────────────────────────────────────

export const palette = {
  /**
   * Jet — deep black inspired by the calligraphy ink of the wordmark.
   * Used for primary actions, headings, and brand surfaces.
   * #111111 is the base; tints/shades scale from there.
   */
  jet: {
    50:  '#F5F5F5',
    100: '#E8E8E8',
    200: '#D1D1D1',
    300: '#ABABAB',
    400: '#757575',
    500: '#4A4A4A',
    600: '#2E2E2E',
    700: '#1A1A1A',
    800: '#111111',   // ← primary brand color
    900: '#0A0A0A',
    950: '#050505',
  },

  /**
   * Forest — rich dark green taken from the logo tagline colour.
   * Used for accents, CTAs, active navigation, and highlights.
   * #1A5C32 is the base; tints scale lighter for UI affordances.
   */
  forest: {
    50:  '#E8F5ED',
    100: '#C5E5CF',
    200: '#9DD4B0',
    300: '#6DC08D',
    400: '#45AE71',   // mid-point
    500: '#2E9E5A',
    600: '#1F7A41',
    700: '#1A5C32',   // ← primary accent / tagline colour
    800: '#134525',
    900: '#0C2E18',
    950: '#061710',
  },

  /**
   * Neutral — clean off-whites and cool grays for backgrounds and borders.
   */
  neutral: {
    0:   '#FFFFFF',
    50:  '#FAFAFA',
    100: '#F5F5F5',
    200: '#EBEBEB',
    300: '#D4D4D4',
    400: '#ABABAB',
    500: '#7A7A7A',
    600: '#555555',
    700: '#383838',
    800: '#202020',
    900: '#0E0E0E',
  },

  /**
   * Semantic — standard status colors.
   */
  semantic: {
    success: '#22C55E',
    warning: '#F59E0B',
    error:   '#EF4444',
    info:    '#3B82F6',
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// CSS Variable Mappings (HSL — used in index.css and Tailwind)
// jet-800 #111111   → HSL(0, 0%, 7%)
// forest-700 #1A5C32 → HSL(142, 56%, 23%)
// ─────────────────────────────────────────────────────────────────────────────

export const cssVars = {
  light: {
    '--background':              '0 0% 100%',
    '--foreground':              '0 0% 7%',            // jet-800 #111111
    '--card':                    '0 0% 100%',
    '--card-foreground':         '0 0% 7%',
    '--popover':                 '0 0% 100%',
    '--popover-foreground':      '0 0% 7%',
    '--primary':                 '0 0% 7%',            // jet-800 #111111
    '--primary-foreground':      '0 0% 100%',          // white
    '--secondary':               '142 56% 23%',        // forest-700 #1A5C32
    '--secondary-foreground':    '0 0% 100%',          // white on green
    '--accent':                  '142 30% 94%',        // very light green tint
    '--accent-foreground':       '142 56% 23%',        // forest-700
    '--muted':                   '0 0% 96%',           // near-white gray
    '--muted-foreground':        '0 0% 44%',           // medium gray
    '--border':                  '0 0% 88%',           // light gray
    '--input':                   '0 0% 88%',
    '--ring':                    '142 56% 23%',        // forest green ring
    '--destructive':             '0 84% 60%',
    '--destructive-foreground':  '0 0% 100%',
    '--radius':                  '0.625rem',
    // Chart palette
    '--chart-1':                 '0 0% 7%',            // jet
    '--chart-2':                 '142 56% 23%',        // forest
    '--chart-3':                 '0 0% 35%',           // dark gray
    '--chart-4':                 '142 40% 48%',        // medium green
    '--chart-5':                 '0 0% 60%',           // mid gray
    // Sidebar — very dark black surface
    '--sidebar-background':      '0 0% 7%',            // jet-800
    '--sidebar-foreground':      '0 0% 95%',
    '--sidebar-primary':         '142 50% 40%',        // lighter forest green (visible on dark)
    '--sidebar-primary-foreground': '0 0% 100%',
    '--sidebar-accent':          '0 0% 12%',
    '--sidebar-accent-foreground': '0 0% 90%',
    '--sidebar-border':          '0 0% 16%',
    '--sidebar-ring':            '142 50% 40%',
  },
  dark: {
    '--background':              '0 0% 5%',
    '--foreground':              '0 0% 97%',
    '--card':                    '0 0% 9%',
    '--card-foreground':         '0 0% 97%',
    '--popover':                 '0 0% 9%',
    '--popover-foreground':      '0 0% 97%',
    // Forest green leads in dark mode — pops against the black background
    '--primary':                 '142 50% 42%',        // lighter forest green
    '--primary-foreground':      '0 0% 5%',
    '--secondary':               '0 0% 14%',
    '--secondary-foreground':    '0 0% 95%',
    '--accent':                  '0 0% 12%',
    '--accent-foreground':       '142 40% 60%',
    '--muted':                   '0 0% 10%',
    '--muted-foreground':        '0 0% 58%',
    '--border':                  '0 0% 16%',
    '--input':                   '0 0% 16%',
    '--ring':                    '142 50% 42%',
    '--destructive':             '0 62% 30%',
    '--destructive-foreground':  '0 0% 98%',
    '--radius':                  '0.625rem',
    // Chart palette (dark)
    '--chart-1':                 '142 50% 42%',
    '--chart-2':                 '0 0% 55%',
    '--chart-3':                 '142 40% 60%',
    '--chart-4':                 '0 0% 35%',
    '--chart-5':                 '142 30% 30%',
    // Sidebar (dark)
    '--sidebar-background':      '0 0% 4%',
    '--sidebar-foreground':      '0 0% 92%',
    '--sidebar-primary':         '142 50% 42%',
    '--sidebar-primary-foreground': '0 0% 5%',
    '--sidebar-accent':          '0 0% 10%',
    '--sidebar-accent-foreground': '0 0% 92%',
    '--sidebar-border':          '0 0% 14%',
    '--sidebar-ring':            '142 50% 42%',
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Typography
// ─────────────────────────────────────────────────────────────────────────────

export const typography = {
  fonts: {
    arabic:  "'Almarai', sans-serif",
    latin:   "'Roboto', sans-serif",
    base:    "'Almarai', 'Roboto', sans-serif",
  },
  weights: {
    regular: 400,
    bold:    700,
  },
  scale: {
    xs:   '0.75rem',    // 12px
    sm:   '0.875rem',   // 14px
    base: '1rem',       // 16px
    lg:   '1.125rem',   // 18px
    xl:   '1.25rem',    // 20px
    '2xl': '1.5rem',    // 24px
    '3xl': '1.875rem',  // 30px
    '4xl': '2.25rem',   // 36px
    '5xl': '3rem',      // 48px
  },
  lineHeight: {
    tight:   '1.25',
    normal:  '1.6',
    relaxed: '1.8',
  },
  letterSpacing: {
    tight:  '-0.02em',
    normal: '0em',
    wide:   '0.04em',
    wider:  '0.08em',
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Spacing
// ─────────────────────────────────────────────────────────────────────────────

export const spacing = {
  xs:   '0.25rem',   //  4px
  sm:   '0.5rem',    //  8px
  md:   '1rem',      // 16px
  lg:   '1.5rem',    // 24px
  xl:   '2rem',      // 32px
  '2xl': '3rem',     // 48px
  '3xl': '4rem',     // 64px
  '4xl': '6rem',     // 96px
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Border Radius
// ─────────────────────────────────────────────────────────────────────────────

export const radius = {
  none:  '0',
  sm:    '0.375rem',  //  6px
  md:    '0.625rem',  // 10px  ← base (var --radius)
  lg:    '0.875rem',  // 14px
  xl:    '1.25rem',   // 20px
  '2xl': '1.75rem',   // 28px
  full:  '9999px',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Shadows
// ─────────────────────────────────────────────────────────────────────────────

export const shadows = {
  sm:    '0 1px 3px 0 rgb(17 17 17 / 0.08)',
  md:    '0 4px 12px 0 rgb(17 17 17 / 0.10)',
  lg:    '0 10px 30px 0 rgb(17 17 17 / 0.14)',
  xl:    '0 20px 50px 0 rgb(17 17 17 / 0.18)',
  green: '0 0 20px 0 rgb(26 92 50 / 0.28)',   // glow for forest green CTAs
  inner: 'inset 0 2px 4px 0 rgb(17 17 17 / 0.06)',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Animation
// ─────────────────────────────────────────────────────────────────────────────

export const animation = {
  duration: {
    fast:   '150ms',
    normal: '250ms',
    slow:   '400ms',
    slower: '600ms',
  },
  easing: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring:  'cubic-bezier(0.34, 1.56, 0.64, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeIn:  'cubic-bezier(0.4, 0, 1, 1)',
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Layout
// ─────────────────────────────────────────────────────────────────────────────

export const layout = {
  mobileMaxWidth:  '500px',
  sidebarWidth:    '260px',
  headerHeight:    '64px',
  bottomNavHeight: '64px',
  contentPadding:  '1.25rem',   // 20px
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Named export — import { brand } for convenience
// ─────────────────────────────────────────────────────────────────────────────

export const brand = {
  identity:   brandIdentity,
  logos:      brandLogos,
  palette,
  cssVars,
  typography,
  spacing,
  radius,
  shadows,
  animation,
  layout,
} as const;

export type Brand = typeof brand;
export default brand;
