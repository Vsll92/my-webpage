'use client'

/**
 * Fixtures page — /fixtures
 *
 * Shows upcoming and completed fixtures by matchweek.
 * Default: current/most recent matchweek.
 */

import type { Metadata } from 'next'
import { useState } from 'react'
import { FixtureCard } from '@/components/matches/FixtureCard'
import { MatchweekNavigator } from '@/components/matches/MatchweekNavigator'
import { SkeletonFixtureCard } from '@/components/ui/Skeletons'
import { EmptyState } from '@/components/ui/EmptyState'
import { useFixtures } from '@/hooks/useFixtures'
import { useHomepage } from '@/hooks/useHomepage'

export default function FixturesPage() {
  const { currentWeek } = useHomepage()
  const [week, setWeek] = useState<number | undefined>(undefined)

  // Once we know the current week, initialise to it
  const targetWeek = week ?? currentWeek ?? undefined

  const { fixtures, isLoading } = useFixtures(targetWeek)

  return (
    <div className="page-container py-10">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="type-heading-lg text-[var(--text-primary)]">Fixtures</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            France Ligue 1 · 2025–26
          </p>
        </div>

        {targetWeek != null && (
          <MatchweekNavigator
            currentWeek={targetWeek}
            minWeek={1}
            maxWeek={34}
            onChange={setWeek}
          />
        )}
      </div>

      {/* ── Fixture list ────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <SkeletonFixtureCard key={i} />
          ))}
        </div>
      ) : fixtures.length === 0 ? (
        <EmptyState
          heading="No fixtures found"
          body="No matches scheduled for this matchweek. Try navigating to a different week."
          icon="list"
        />
      ) : (
        <div className="space-y-3">
          {fixtures.map((fixture) => (
            <FixtureCard
              key={fixture.match_id}
              matchId={fixture.match_id}
              homeTeamId={fixture.home_team_id}
              homeTeamName={fixture.home_team_name}
              awayTeamId={fixture.away_team_id}
              awayTeamName={fixture.away_team_name}
              status={fixture.status}
              kickOffTime={fixture.local_time ?? undefined}
              localDate={fixture.local_date}
              homeGoals={fixture.home_goals}
              awayGoals={fixture.away_goals}
              homeForm={fixture.home_form}
              awayForm={fixture.away_form}
              homeXg={fixture.home_xg}
              awayXg={fixture.away_xg}
              week={fixture.week}
            />
          ))}
        </div>
      )}

      {/* ── Footer note ─────────────────────────────────────────────────────── */}
      <p className="text-xs text-[var(--text-muted)] mt-8 text-center">
        Form: last 5 league matches. All times in CET.
        Click any match for full tactical analysis.
      </p>
    </div>
  )
}
