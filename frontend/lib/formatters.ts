/**
 * Shared formatting utilities used across components.
 *
 * All formatters are pure functions — no React, no side effects.
 * Import only what you need to keep bundle size minimal.
 */

// ── Numbers ───────────────────────────────────────────────────────────────────

/** Format xG to 2 decimal places: 0.85 → "0.85" */
export function formatXG(xg: number | null | undefined): string {
  if (xg == null || !isFinite(xg)) return '—'
  return xg.toFixed(2)
}

/** Format a percentage: 81.3 → "81.3%" */
export function formatPct(pct: number | null | undefined): string {
  if (pct == null || !isFinite(pct)) return '—'
  return `${pct.toFixed(1)}%`
}

/** Format PPDA: 7.33 → "7.3" (1 decimal is enough for PPDA) */
export function formatPPDA(ppda: number | null | undefined): string {
  if (ppda == null || !isFinite(ppda)) return '—'
  return ppda.toFixed(1)
}

/** Format a delta with sign: +2.3 / -1.1 / 0.0 */
export function formatDelta(delta: number | null | undefined): string {
  if (delta == null || !isFinite(delta)) return '—'
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta.toFixed(1)}`
}

/** Abbreviate large integers: 47000 → "47K" */
export function formatAttendance(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`
  return n.toString()
}

// ── Dates ─────────────────────────────────────────────────────────────────────

/** Format a date string to short display: "2026-01-18" → "Sat 18 Jan" */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
  } catch {
    return dateStr
  }
}

/** Format a date to just "Jan 18" */
export function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  } catch {
    return dateStr
  }
}

/** Format kick-off time string: "19:00:00" → "19:00" */
export function formatKickOff(timeStr: string | null | undefined): string {
  if (!timeStr) return 'TBC'
  const parts = timeStr.split(':')
  if (parts.length >= 2) return `${parts[0]}:${parts[1]}`
  return timeStr
}

// ── Match ─────────────────────────────────────────────────────────────────────

/** Format a formation integer: 3142 → "3-1-4-2" */
export function formatFormation(formation: string | number | null | undefined): string {
  if (formation == null) return '—'
  const s = String(formation).replace(/\D/g, '')
  return s.split('').join('-')
}

/** Match result label: "W" → "Win", "D" → "Draw", "L" → "Loss" */
export function resultLabel(result: 'W' | 'D' | 'L'): string {
  return { W: 'Win', D: 'Draw', L: 'Loss' }[result]
}

// ── Pitch coordinate helpers ──────────────────────────────────────────────────

/**
 * Normalize an away team shot's x-coordinate for "unified goal" display.
 *
 * After pipeline normalization:
 *   - Home shots: x > 60 (attacking toward x=100)
 *   - Away shots: x < 40 (attacking toward x=0)
 *
 * For a "both teams attack the same goal" shot map variant,
 * flip away x: displayX = 100 - awayX
 *
 * Use this ONLY if you want a unified-direction shot map.
 * The default bidirectional shot map does NOT flip.
 */
export function unifyAwayX(x: number, isHome: boolean): number {
  return isHome ? x : 100 - x
}

/** Same for y-coordinate in unified mode */
export function unifyAwayY(y: number, isHome: boolean): number {
  return isHome ? y : 100 - y
}
