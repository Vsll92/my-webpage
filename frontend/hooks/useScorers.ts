import useSWR from 'swr'
import { fetcher } from '@/lib/api'
import { CACHE_TTL } from '@/lib/constants'

export interface ScorerRow {
  rank: number
  player_id: string
  player_name: string
  team_id: string
  team_name: string
  position?: string | null
  matches: number
  minutes: number
  goals: number
  assists: number
  shots: number
  shots_on_target: number
  shots_per90?: number | null
  xg?: number | null
  npxg?: number | null
  xg_per_shot?: number | null
  goals_above_xg?: number | null
  big_chances?: number | null
}

export function useScorers(opts?: { season?: string; minApps?: number; limit?: number }) {
  const params = new URLSearchParams()
  if (opts?.season)  params.set('season', opts.season)
  if (opts?.minApps) params.set('min_apps', String(opts.minApps))
  if (opts?.limit)   params.set('limit', String(opts.limit))

  const query = params.toString()
  const { data, error, isLoading } = useSWR<{ season: string; rows: ScorerRow[] }>(
    `/api/scorers${query ? `?${query}` : ''}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: CACHE_TTL.STANDINGS,
    },
  )
  return { scorers: data?.rows ?? [], error, isLoading }
}
