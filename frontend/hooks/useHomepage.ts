import useSWR from 'swr'
import { fetcher } from '@/lib/api'
import type { MatchSummary } from './useFixtures'
import type { StandingRow } from './useStandings'

export interface TopPerformer {
  player_name: string
  team_id: string
  team_name: string
  metric_label: string
  metric_value: number
}

export interface HomepageData {
  current_week: number
  fixtures: MatchSummary[]
  standings_top8: StandingRow[]
  top_performers: TopPerformer[]
}

export function useHomepage() {
  const { data, error, isLoading } = useSWR<HomepageData>(
    '/api/homepage',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 3600_000, // 1 hour
    },
  )
  return {
    homepage: data ?? null,
    currentWeek: data?.current_week ?? null,
    fixtures: data?.fixtures ?? [],
    standingsTop8: data?.standings_top8 ?? [],
    topPerformers: data?.top_performers ?? [],
    error,
    isLoading,
  }
}
