'use client'

/**
 * Theme Provider — dark/light mode with safe SSR hydration.
 *
 * Approach:
 *   - Theme is stored in localStorage as 'pr_theme' ('dark' | 'light')
 *   - Applied as data-theme="dark"|"light" on the <html> element
 *   - Default: 'dark' (football analytics is a night-session product)
 *   - SSR safe: avoids hydration mismatch by suppressing the initial render
 *     flash via the inline script in layout.tsx
 *
 * Usage:
 *   import { useTheme } from '@/contexts/ThemeContext'
 *   const { theme, toggleTheme } = useTheme()
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  isResolved: boolean  // false during SSR / initial hydration
}

// ── Context ───────────────────────────────────────────────────────────────────

const ThemeContext = createContext<ThemeContextValue | null>(null)

// ── Storage ───────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'pr_theme'
const DEFAULT_THEME: Theme = 'dark'

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return DEFAULT_THEME
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
  return stored === 'light' || stored === 'dark' ? stored : DEFAULT_THEME
}

function applyTheme(theme: Theme): void {
  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  // Also set color-scheme for native browser UI (scrollbars, inputs)
  root.style.colorScheme = theme
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Start with DEFAULT_THEME to match SSR output.
  // The real theme is read from localStorage on mount.
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME)
  const [isResolved, setIsResolved] = useState(false)

  // On mount: read from localStorage and apply to DOM
  useEffect(() => {
    const stored = getStoredTheme()
    setThemeState(stored)
    applyTheme(stored)
    setIsResolved(true)
  }, [])

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme)
    applyTheme(newTheme)
    localStorage.setItem(STORAGE_KEY, newTheme)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme, setTheme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, isResolved }}>
      {children}
    </ThemeContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used inside <ThemeProvider>')
  }
  return ctx
}

// ── Inline script (paste into layout.tsx <head>) ──────────────────────────────
// This script runs before React hydrates, preventing a flash of the wrong theme.
// It reads localStorage and sets data-theme on <html> synchronously.
export const THEME_INIT_SCRIPT = `
(function() {
  try {
    var stored = localStorage.getItem('pr_theme');
    var theme = (stored === 'light' || stored === 'dark') ? stored : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
  } catch(e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`.trim()
