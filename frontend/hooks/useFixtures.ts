import useSWR from 'swr'
import { fetcher } from '@/lib/api'
import { CACHE_TTL } from '@/lib/constants'

export interface MatchSummary {
  match_id: string
  week: number
  local_date: string
  local_time?: string | null
  home_team_id: string
  home_team_name: string
  away_team_id: string
  away_team_name: string
  home_goals?: number | null
  away_goals?: number | null
  home_xg?: number | null
  away_xg?: number | null
  status: 'upcoming' | 'completed' | 'live' | 'postponed'
  home_form: Array<'W' | 'D' | 'L'>
  away_form: Array<'W' | 'D' | 'L'>
  match_badge?: string | null
}

export function useFixtures(week?: number, teamId?: string, season?: string) {
  const params = new URLSearchParams()
  if (week)   params.set('week', String(week))
  if (teamId) params.set('team_id', teamId)
  if (season) params.set('season', season)

  const query = params.toString()
  const { data, error, isLoading } = useSWR<MatchSummary[]>(
    `/api/fixtures${query ? `?${query}` : ''}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: CACHE_TTL.FIXTURES,
    },
  )
  return { fixtures: data ?? [], error, isLoading }
}

export function useResults(weeks?: number, teamId?: string, season?: string) {
  const params = new URLSearchParams()
  if (weeks)  params.set('weeks', String(weeks))
  if (teamId) params.set('team_id', teamId)
  if (season) params.set('season', season)

  const query = params.toString()
  const { data, error, isLoading } = useSWR<MatchSummary[]>(
    `/api/results${query ? `?${query}` : ''}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: CACHE_TTL.FIXTURES,
    },
  )
  return { results: data ?? [], error, isLoading }
}
