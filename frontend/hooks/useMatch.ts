import useSWR from 'swr'
import { fetcher } from '@/lib/api'
import { CACHE_TTL } from '@/lib/constants'
import type { ShotOutcome } from '@/lib/constants'

// ── Match detail ──────────────────────────────────────────────────────────────
export function useMatch(matchId: string | null) {
  const { data, error, isLoading } = useSWR(
    matchId ? `/api/matches/${matchId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: CACHE_TTL.COMPLETED_MATCH,
    },
  )
  return { match: data ?? null, error, isLoading }
}

// ── Match shots ───────────────────────────────────────────────────────────────
export interface ShotData {
  id: number
  player_name: string
  team_id: string
  is_home: boolean
  minute: number
  period: number
  x: number
  y: number
  xg?: number | null
  outcome: ShotOutcome
  is_header: boolean
  is_penalty: boolean
  zone?: string | null
}

export function useMatchShots(
  matchId: string | null,
  filters: { period?: 'all' | '1' | '2'; team?: 'all' | 'home' | 'away' } = {},
) {
  const params = new URLSearchParams()
  if (filters.period && filters.period !== 'all') params.set('period', filters.period)
  if (filters.team   && filters.team   !== 'all') params.set('team',   filters.team)
  const query = params.toString()

  const { data, error, isLoading } = useSWR<{ match_id: string; shots: ShotData[] }>(
    matchId ? `/api/matches/${matchId}/shots${query ? `?${query}` : ''}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: CACHE_TTL.COMPLETED_MATCH,
    },
  )
  return { shots: data?.shots ?? [], error, isLoading }
}

// ── xG flow ───────────────────────────────────────────────────────────────────
export interface XGPoint    { minute: number; cumulative_xg: number }
export interface XGGoal     { team_id: string; minute: number; xg_at_time: number }
export interface XGFlowData {
  match_id: string
  home_team_id: string
  away_team_id: string
  home_team_name: string
  away_team_name: string
  home_xg_by_minute: XGPoint[]
  away_xg_by_minute: XGPoint[]
  goals: XGGoal[]
}

export function useXGFlow(matchId: string | null) {
  const { data, error, isLoading } = useSWR<XGFlowData>(
    matchId ? `/api/matches/${matchId}/xg-flow` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: CACHE_TTL.COMPLETED_MATCH,
    },
  )
  return { xgFlow: data ?? null, error, isLoading }
}

// ── Tactical ──────────────────────────────────────────────────────────────────
export function useMatchTactical(matchId: string | null) {
  const { data, error, isLoading } = useSWR(
    matchId ? `/api/matches/${matchId}/tactical` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: CACHE_TTL.COMPLETED_MATCH,
    },
  )
  return { tactical: data ?? null, error, isLoading }
}
