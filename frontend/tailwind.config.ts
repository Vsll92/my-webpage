import type { Config } from 'tailwindcss'

const config: Config = {
  // ── Content paths — Tailwind scans these for class names ─────────────────
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './contexts/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],

  // ── Dark mode via data attribute (matches our ThemeProvider) ─────────────
  // We use data-theme="dark" on <html> rather than a .dark class.
  // This avoids class conflicts with Tailwind's own dark: variant system.
  // Note: Tailwind dark: variants are NOT used — all theming goes through CSS variables.
  darkMode: ['class', '[data-theme="dark"]'],

  theme: {
    extend: {
      // ── Font families ───────────────────────────────────────────────────
      fontFamily: {
        display: ['"Instrument Serif"', 'Georgia', 'serif'],
        sans:    ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono:    ['"DM Mono"', '"Fira Code"', 'monospace'],
      },

      // ── Colors via CSS variables ─────────────────────────────────────────
      // These map Tailwind class names to CSS custom properties defined
      // in globals.css. Tailwind computes only the utility class;
      // the actual color value comes from the CSS variable at render time.
      // This means dark mode "just works" without any Tailwind dark: prefixes.
      colors: {
        'bg-base':    'var(--bg-base)',
        'bg-surface': 'var(--bg-surface)',
        'bg-hover':   'var(--bg-hover)',
        'bg-subtle':  'var(--bg-subtle)',

        'border-default': 'var(--border-default)',
        'border-strong':  'var(--border-strong)',

        'text-primary':   'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted':     'var(--text-muted)',

        'accent':        'var(--accent-primary)',
        'accent-green':  'var(--accent-secondary)',
        'accent-red':    'var(--accent-warning)',
        'accent-amber':  'var(--accent-amber)',

        'pitch':         'var(--pitch-surface)',
        'pitch-lines':   'var(--pitch-lines)',

        'shot-goal':     'var(--shot-goal)',
        'shot-saved':    'var(--shot-saved)',
        'shot-miss':     'var(--shot-miss)',
        'shot-blocked':  'var(--shot-blocked)',

        'pro-bg':        'var(--pro-bg)',
        'pro-border':    'var(--pro-border)',
        'pro-text':      'var(--pro-text)',
      },

      // ── Spacing scale ────────────────────────────────────────────────────
      // Base unit: 4px (Tailwind default). Our 8px grid = spacing-2.
      // No custom spacing — use Tailwind's built-in scale consistently.

      // ── Border radius ────────────────────────────────────────────────────
      borderRadius: {
        'card': '12px',
        'pill': '9999px',
      },

      // ── Box shadows ──────────────────────────────────────────────────────
      boxShadow: {
        'card':     'var(--shadow-card)',
        'elevated': 'var(--shadow-elevated)',
      },

      // ── Max width for page containers ────────────────────────────────────
      maxWidth: {
        'page': '1280px',
      },

      // ── Typography sizes ─────────────────────────────────────────────────
      fontSize: {
        'xs':   ['12px', { lineHeight: '16px' }],
        'sm':   ['14px', { lineHeight: '20px' }],
        'base': ['16px', { lineHeight: '24px' }],
        'lg':   ['20px', { lineHeight: '28px' }],
        'xl':   ['24px', { lineHeight: '32px' }],
        '2xl':  ['32px', { lineHeight: '40px' }],
        '3xl':  ['48px', { lineHeight: '56px' }],
        '4xl':  ['64px', { lineHeight: '72px' }],
      },
    },
  },
  plugins: [],
}

export default config
