/**
 * Shared constants — used across components.
 *
 * RULE: Shot outcome colors are defined ONCE here and never duplicated.
 * Any component needing outcome colors imports from this file.
 */

// ── Shot outcome colors ───────────────────────────────────────────────────────
// These map to CSS custom properties defined in globals.css.
// Using CSS variables (not hardcoded hex) means they respect the active theme.
export const SHOT_OUTCOME_COLORS = {
  goal:    'var(--shot-goal)',
  saved:   'var(--shot-saved)',
  miss:    'var(--shot-miss)',
  blocked: 'var(--shot-blocked)',
} as const

export type ShotOutcome = keyof typeof SHOT_OUTCOME_COLORS

// ── Match result colors ───────────────────────────────────────────────────────
export const RESULT_COLORS = {
  W: 'var(--accent-secondary)',  // green
  D: 'var(--text-muted)',        // grey
  L: 'var(--accent-warning)',    // red
} as const

export type MatchResult = keyof typeof RESULT_COLORS

// ── Pitch dimensions (SVG coordinate space) ───────────────────────────────────
// Internal SVG units. Data coordinates (0-100) are mapped to these.
export const PITCH = {
  WIDTH:  1050,   // 105m × 10
  HEIGHT:  680,   // 68m × 10
  // Penalty box dimensions
  BOX_LENGTH:     165,   // 16.5m × 10
  BOX_WIDTH:      403,   // 40.3m × 10
  // 6-yard box
  SIX_YARD_LENGTH:  55,
  SIX_YARD_WIDTH:  183,
  // Goal
  GOAL_WIDTH:       73,
  // Centre circle radius
  CENTRE_CIRCLE_R: 91.5,
  // Penalty spot distance from goal line
  PENALTY_SPOT_X:  110,
} as const

/**
 * Convert data coordinates (0-100 scale, normalized after ingestion)
 * to SVG pixel coordinates.
 *
 * COORDINATE MODEL (bidirectional):
 *   After normalization in the pipeline:
 *   - Home team shots:  x > 60 (they attack toward x=100, the right goal)
 *   - Away team shots:  x < 40 (they attack toward x=0, the left goal)
 *
 *   This is a match-perspective map: home attacks right, away attacks left.
 *   Caption on shot maps: "Attack direction: left → right for the home team."
 *
 *   For a "both teams attack the same goal" view, flip away x at display time:
 *     displayX = shot.is_home ? shot.x : (100 - shot.x)
 *
 * @param dataX - x in data space (0 = home goal line, 100 = away goal line)
 * @param dataY - y in data space (0 = bottom touchline, 100 = top touchline)
 */
export function toSVGCoords(dataX: number, dataY: number): { cx: number; cy: number } {
  return {
    cx: (dataX / 100) * PITCH.WIDTH,
    cy: (dataY / 100) * PITCH.HEIGHT,
  }
}

/**
 * Calculate shot dot radius from xG value.
 *
 * Fan mode: all dots are the same size (equal emphasis, no xG information).
 * Pro mode: dots are sized proportionally to xG (larger = better chance).
 *
 * Min radius: 4px  (very low xG speculative shot)
 * Max radius: 20px (penalty or tap-in with xG near 1.0)
 *
 * Formula: 4 + xg * 16 → at xg=0: r=4, at xg=1: r=20
 */
export function shotDotRadius(xg: number, isProMode: boolean): number {
  if (!isProMode) return 6  // Fan mode: uniform size
  return Math.max(4, Math.min(20, 4 + xg * 16))
}

// ── League configuration ──────────────────────────────────────────────────────
export const LIGUE_1 = {
  COMPETITION_ID: 'dm5ka0os1e3dxcp3vh05kmp33',
  NAME: 'Ligue 1',
  SEASON: '25-26',
  TEAMS_COUNT: 18,
  MATCHWEEKS: 34,
  // Zone thresholds (top of table = position 1)
  ZONES: {
    CHAMPIONS_LEAGUE: [1, 2, 3],
    EUROPA_LEAGUE: [4],
    RELEGATION: [16, 17, 18],
  },
} as const

// ── Cache TTLs (milliseconds, for SWR dedupingInterval) ──────────────────────
export const CACHE_TTL = {
  COMPLETED_MATCH: 24 * 60 * 60 * 1000,  // 24 hours — completed match data never changes
  STANDINGS:        6 * 60 * 60 * 1000,  // 6 hours
  FIXTURES:         1 * 60 * 60 * 1000,  // 1 hour
  TEAM_OVERVIEW:    6 * 60 * 60 * 1000,  // 6 hours
} as const
