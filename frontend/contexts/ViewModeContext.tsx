'use client'

/**
 * View Mode Provider — Fan/Pro toggle.
 *
 * Controls which layer of content is visible across the entire product:
 *   Fan mode  — public, beginner-friendly content. No xG, no PPDA, no advanced analytics.
 *   Pro mode  — full analytical content. xG, PPDA, tactical metrics, advanced visuals.
 *
 * In Sprint 0 / V1: this is NOT gated by authentication or payment.
 * The toggle is free and persists in localStorage.
 * Paywall logic is added in V1.1 when Stripe integration ships.
 *
 * Usage:
 *   import { useViewMode } from '@/contexts/ViewModeContext'
 *   const { mode, isProMode, setMode, toggleMode } = useViewMode()
 *
 * Example in a component:
 *   const { isProMode } = useViewMode()
 *   {isProMode && <XGFlowChart />}
 *   {!isProMode && <ProLock ctaText="See xG timeline — Pro" />}
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

export type ViewMode = 'fan' | 'pro'

interface ViewModeContextValue {
  mode: ViewMode
  isProMode: boolean   // convenience: mode === 'pro'
  isFanMode: boolean   // convenience: mode === 'fan'
  setMode: (mode: ViewMode) => void
  toggleMode: () => void
  isResolved: boolean  // false during SSR, true after localStorage is read
}

// ── Context ───────────────────────────────────────────────────────────────────

const ViewModeContext = createContext<ViewModeContextValue | null>(null)

// ── Storage ───────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'pr_view_mode'
const DEFAULT_MODE: ViewMode = 'fan'

function getStoredMode(): ViewMode {
  if (typeof window === 'undefined') return DEFAULT_MODE
  const stored = localStorage.getItem(STORAGE_KEY) as ViewMode | null
  return stored === 'fan' || stored === 'pro' ? stored : DEFAULT_MODE
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ViewMode>(DEFAULT_MODE)
  const [isResolved, setIsResolved] = useState(false)

  // Read from localStorage on mount (client-side only)
  useEffect(() => {
    const stored = getStoredMode()
    setModeState(stored)
    setIsResolved(true)
  }, [])

  const setMode = useCallback((newMode: ViewMode) => {
    setModeState(newMode)
    localStorage.setItem(STORAGE_KEY, newMode)
  }, [])

  const toggleMode = useCallback(() => {
    setMode(mode === 'fan' ? 'pro' : 'fan')
  }, [mode, setMode])

  return (
    <ViewModeContext.Provider
      value={{
        mode,
        isProMode: mode === 'pro',
        isFanMode: mode === 'fan',
        setMode,
        toggleMode,
        isResolved,
      }}
    >
      {children}
    </ViewModeContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useViewMode(): ViewModeContextValue {
  const ctx = useContext(ViewModeContext)
  if (!ctx) {
    throw new Error('useViewMode must be used inside <ViewModeProvider>')
  }
  return ctx
}
