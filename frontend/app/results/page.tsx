'use client'

/**
 * Results page — /results
 *
 * Completed matches, reverse-chronological.
 * Default: last 3 matchweeks.
 */

import { FixtureCard } from '@/components/matches/FixtureCard'
import { SkeletonFixtureCard } from '@/components/ui/Skeletons'
import { EmptyState } from '@/components/ui/EmptyState'
import { useResults } from '@/hooks/useFixtures'

export default function ResultsPage() {
  const { results, isLoading } = useResults(3)

  // Group by week
  const byWeek = results.reduce<Record<number, typeof results>>((acc, r) => {
    const w = r.week
    if (!acc[w]) acc[w] = []
    acc[w].push(r)
    return acc
  }, {})

  const weeks = Object.keys(byWeek)
    .map(Number)
    .sort((a, b) => b - a)

  return (
    <div className="page-container py-10">
      <div className="mb-6">
        <h1 className="type-heading-lg text-[var(--text-primary)]">Results</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          France Ligue 1 · 2025–26 · Last 3 matchweeks
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 9 }).map((_, i) => <SkeletonFixtureCard key={i} />)}
        </div>
      ) : results.length === 0 ? (
        <EmptyState
          heading="No results yet"
          body="No completed matches found for the recent matchweeks."
          icon="list"
        />
      ) : (
        <div className="space-y-8">
          {weeks.map((week) => (
            <section key={week}>
              <h2 className="text-xs type-label text-[var(--text-muted)] mb-3">
                Matchweek {week}
              </h2>
              <div className="space-y-3">
                {byWeek[week].map((r) => (
                  <FixtureCard
                    key={r.match_id}
                    matchId={r.match_id}
                    homeTeamId={r.home_team_id}
                    homeTeamName={r.home_team_name}
                    awayTeamId={r.away_team_id}
                    awayTeamName={r.away_team_name}
                    status={r.status}
                    localDate={r.local_date}
                    homeGoals={r.home_goals}
                    awayGoals={r.away_goals}
                    homeXg={r.home_xg}
                    awayXg={r.away_xg}
                    week={r.week}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
