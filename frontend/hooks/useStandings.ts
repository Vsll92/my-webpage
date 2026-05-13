import useSWR from 'swr'
import { fetcher } from '@/lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StandingRow {
  position: number
  team_id: string
  team_name: string
  played: number
  won: number
  drawn: number
  lost: number
  goals_for: number
  goals_against: number
  goal_diff: number
  points: number
  form: Array<'W' | 'D' | 'L'>
  xg_for?: number | null
  xg_against?: number | null
  xg_diff?: number | null
  xg_delta?: number | null
}

export interface StandingsData {
  season: string
  competition_id: string
  rows: StandingRow[]
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Fetch league standings from GET /api/standings
 *
 * The backend defaults season → settings.DEFAULT_SEASON ("25-26")
 * and competition_id → settings.COMPETITION_ID ("dm5ka0os1e3dxcp3vh05kmp33").
 * No params are required unless you want to override the season.
 *
 * Response shape: { season, competition_id, rows: StandingRow[] }
 */
export function useStandings(season?: string) {
  // Build query string — only append ?season= if caller provides one.
  // The backend correctly defaults to 25-26 when omitted.
  const query = season ? `?season=${encodeURIComponent(season)}` : ''

  const { data, error, isLoading, mutate } = useSWR<StandingsData>(
    `/api/standings${query}`,
    fetcher,
    {
      // Do not refetch when the user switches browser tabs — standings
      // change at most once a week, not in real-time.
      revalidateOnFocus: false,

      // Always fetch fresh data on mount, even if there is a cached value.
      // This guarantees first-load users see real data, not a stale skeleton.
      revalidateOnMount: true,

      // Deduplicate rapid re-renders within a 30-second window.
      // (Not 6 hours — that was far too long for a page that needs to
      // display real data on the first visit after a cold start.)
      dedupingInterval: 30_000,

      // Retry up to 3 times with exponential back-off if the API is slow
      // to start or briefly unreachable.
      errorRetryCount: 3,
    },
  )

  return {
    standings: data?.rows ?? [],
    season: data?.season,
    error,
    isLoading,
    mutate,
  }
}
