/**
 * HomePilot Design System — Centralized Tokens
 *
 * Single source of truth for all design values.
 * Use these in TSX/JS runtime logic (e.g. conditional class selection).
 *
 * The canonical token values are also expressed as CSS custom properties in
 * index.css and surfaced as Tailwind utilities via tailwind.config.js.
 * Always prefer Tailwind classes in JSX; only use this module for
 * programmatic or conditional class generation.
 */

// ── Color Palette ────────────────────────────────────────────────────────────

export const colors = {
  /** Page / app background — deepest surface */
  background: '#0B0F14',

  /** Default surface (cards, sidebars) */
  surface: '#0F141A',

  /** Elevated surfaces (modals, popovers) */
  elevated: '#151B22',

  /** Subtle UI borders */
  border: '#1F2A35',

  /** Primary readable text */
  textPrimary: '#E6EDF3',

  /** Secondary / sub-label text */
  textSecondary: '#9BA7B4',

  /** Muted / hint text */
  textMuted: '#6B7682',

  /** Brand accent — interactions, links, primary actions */
  primary: '#3AA0FF',

  /** Semantic: success, ON state, healthy status */
  success: '#22C55E',

  /** Semantic: warning, degraded state, attention */
  warning: '#F59E0B',

  /** Semantic: error, danger, destructive actions */
  danger: '#EF4444',
} as const;

// ── Spacing Scale ─────────────────────────────────────────────────────────────
// Mirrors Tailwind's 4px base unit. Use Tailwind classes in JSX; use these
// for dynamic calculations or non-Tailwind contexts.

export const spacing = {
  /** 4px */   xs:  '0.25rem',
  /** 8px */   sm:  '0.5rem',
  /** 12px */  md:  '0.75rem',
  /** 16px */  base: '1rem',
  /** 24px */  lg:  '1.5rem',
  /** 32px */  xl:  '2rem',
  /** 48px */  '2xl': '3rem',
  /** 64px */  '3xl': '4rem',
} as const;

// ── Border Radius ─────────────────────────────────────────────────────────────

export const radius = {
  /** 6px  — small badges, tags */             sm: '0.375rem',
  /** 10px — inputs, compact buttons */        md: '0.625rem',
  /** 14px — standard cards and buttons */     lg: '0.875rem',
  /** 20px — large cards */                    xl: '1.25rem',
  /** 28px — hero cards, modals */             '2xl': '1.75rem',
  /** 36px — full-premium cards */             '3xl': '2.25rem',
  /** 9999px — pills, avatars, dots */         full: '9999px',
} as const;

// ── Elevation / Shadows ──────────────────────────────────────────────────────

export const shadows = {
  /** Subtle container lift */
  sm: '0 1px 3px 0 rgb(0 0 0 / 0.4)',

  /** Default card shadow */
  md: '0 4px 12px -2px rgb(0 0 0 / 0.5)',

  /** Elevated card / dropdown */
  lg: '0 8px 24px -4px rgb(0 0 0 / 0.6)',

  /** Modals / full overlays */
  xl: '0 20px 60px -10px rgb(0 0 0 / 0.7)',

  /** Primary glow — used sparingly on interactive elements */
  primaryGlow: `0 0 16px -4px ${colors.primary}66`,

  /** Success glow — status indicators */
  successGlow: `0 0 8px 0 ${colors.success}66`,

  /** Warning glow — status indicators */
  warningGlow: `0 0 8px 0 ${colors.warning}66`,
} as const;

// ── Semantic Utility Builders ─────────────────────────────────────────────────

/**
 * Returns Tailwind class strings for a semantic status color.
 * @example statusClasses('success') → { text: 'text-success', bg: 'bg-success/10', border: 'border-success/20' }
 */
export const statusClasses = (status: 'success' | 'warning' | 'danger' | 'primary') => ({
  text:   `text-${status}`,
  bg:     `bg-${status}/10`,
  border: `border-${status}/20`,
  dot:    `bg-${status}`,
});
