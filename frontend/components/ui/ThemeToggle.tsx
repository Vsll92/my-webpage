'use client'

/**
 * ThemeToggle — dark/light mode switch button.
 *
 * Renders a sun/moon icon button in the top navigation.
 * Suppresses rendering until the theme is resolved from localStorage
 * to prevent hydration mismatch (the button would render the wrong icon on SSR).
 */

import { useTheme } from '@/contexts/ThemeContext'

export function ThemeToggle() {
  const { theme, toggleTheme, isResolved } = useTheme()

  // Render nothing until the stored theme is resolved.
  // This prevents a flash of the wrong icon on initial load.
  if (!isResolved) {
    return (
      <div
        className="w-8 h-8 rounded-md skeleton"
        aria-hidden="true"
      />
    )
  }

  const isDark = theme === 'dark'

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      className={`
        w-8 h-8 rounded-md flex items-center justify-center
        text-[var(--text-secondary)]
        hover:text-[var(--text-primary)]
        hover:bg-[var(--bg-hover)]
        transition-colors duration-[var(--transition-fast)]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]
      `}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}

// ── Icons (inline SVG — no icon library dependency in Sprint 0) ───────────────

function SunIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1"  x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22"  x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1"  y1="12" x2="3"  y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64"  y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}
