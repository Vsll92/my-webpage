import useSWR from 'swr'
import { fetcher } from '@/lib/api'
import { CACHE_TTL } from '@/lib/constants'

export interface FormEntry {
  match_id: string
  date: string
  opponent_name: string
  result: 'W' | 'D' | 'L'
  goals_for: number
  goals_against: number
  xg?: number | null
  xga?: number | null
  is_home: boolean
}

export interface TeamOverview {
  team_id: string
  team_name: string
  season: string
  league_position: number
  played: number
  won: number
  drawn: number
  lost: number
  goals_for: number
  goals_against: number
  points: number
  xg_for?: number | null
  xg_against?: number | null
  xg_delta?: number | null
  shots_per90?: number | null
  ppda?: number | null
  def_action_height?: number | null
  possession_avg?: number | null
  form: FormEntry[]
  top_scorers: Array<{ player_id: string; player_name: string; goals: number; assists: number }>
}

export function useTeamOverview(teamId: string | null, season?: string, lastN?: number) {
  const params = new URLSearchParams()
  if (season) params.set('season', season)
  if (lastN)  params.set('last_n', String(lastN))
  const query = params.toString()

  const { data, error, isLoading } = useSWR<TeamOverview>(
    teamId ? `/api/teams/${teamId}/overview${query ? `?${query}` : ''}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: CACHE_TTL.TEAM_OVERVIEW,
    },
  )
  return { team: data ?? null, error, isLoading }
}
