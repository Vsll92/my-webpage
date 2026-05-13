'use client'

import { use } from 'react'
import Link from 'next/link'
import { StatTile } from '@/components/ui/StatTile'
import { TeamBadge } from '@/components/teams/TeamBadge'
import { FormStrip } from '@/components/teams/FormStrip'
import { FixtureCard } from '@/components/matches/FixtureCard'
import { ProLock } from '@/components/ui/ProLock'
import { SkeletonTile, SkeletonCard } from '@/components/ui/Skeletons'
import { TeamNotFoundEmpty } from '@/components/ui/EmptyState'
import { useTeamOverview } from '@/hooks/useTeamOverview'
import { useViewMode } from '@/contexts/ViewModeContext'
import { formatFormation } from '@/lib/formatters'

interface PageProps {
  params: Promise<{ teamId: string }>
}

export default function TeamPage({ params }: PageProps) {
  const { teamId } = use(params)
  const { team, isLoading } = useTeamOverview(teamId)
  const { isProMode } = useViewMode()

  if (isLoading) {
    return (
      <div className="page-container py-10">
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4 mb-8">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonTile key={i} />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    )
  }

  if (!team) return <div className="page-container py-16"><TeamNotFoundEmpty /></div>

  return (
    <div className="page-container py-10">

      {/* ── Team header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-5 mb-8">
        <TeamBadge teamId={team.team_id} teamName={team.team_name} size="lg" />
        <div>
          <h1 className="type-heading-lg text-[var(--text-primary)]">{team.team_name}</h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-sm text-[var(--text-muted)]">
              Ligue 1 · 2025–26 · {team.league_position
                ? `${team.league_position}${ordinal(team.league_position)} place`
                : '—'}
            </span>
            <span className="text-sm text-[var(--text-muted)] font-mono">
              {team.won}W – {team.drawn}D – {team.lost}L
            </span>
            <span className="text-sm font-semibold text-[var(--text-primary)] font-mono">
              {team.points} pts
            </span>
          </div>
          {isProMode && team.xg_delta != null && (
            <span
              className={`inline-block mt-2 text-xs font-mono px-2 py-0.5 rounded ${
                team.xg_delta > 0
                  ? 'text-[var(--accent-secondary)] bg-[var(--accent-secondary)] bg-opacity-10'
                  : 'text-[var(--accent-warning)] bg-[var(--accent-warning)] bg-opacity-10'
              }`}
            >
              xG Delta: {team.xg_delta > 0 ? '+' : ''}{team.xg_delta.toFixed(1)}
            </span>
          )}
        </div>
      </div>

      {/* ── Form timeline ─────────────────────────────────────────────────────── */}
      <div className="card mb-6">
        <div className="text-xs type-label text-[var(--text-muted)] mb-3">
          Form — last {Math.min(team.form.length, 10)} matches
        </div>
        <FormStrip
          results={team.form.map(f => ({
            result: f.result,
            opponentName: f.opponent_name,
            goalsFor: f.goals_for,
            goalsAgainst: f.goals_against,
          }))}
          size="lg"
        />
      </div>

      {/* ── Season summary tiles ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-8">
        <StatTile
          label="Goals"
          value={team.goals_for}
          format="integer"
          tooltip="Total goals scored in the league this season."
        />
        <StatTile
          label="Goals Against"
          value={team.goals_against}
          format="integer"
          tooltip="Total goals conceded in the league this season."
        />
        <StatTile
          label="Shots/90"
          value={team.shots_per90}
          format="decimal1"
          tooltip="Average shots per 90 minutes — measures attacking volume."
        />
        <StatTile
          label="xG For"
          value={team.xg_for}
          format="decimal2"
          isPro
          tooltip="Expected Goals — total shot quality created this season. Higher than goals = underperforming."
        />
        <StatTile
          label="xG Against"
          value={team.xg_against}
          format="decimal2"
          isPro
          tooltip="Expected goals conceded. Lower is better for a defensive team."
        />
        <StatTile
          label="PPDA"
          value={team.ppda}
          format="decimal1"
          isPro
          tooltip="Passes Per Defensive Action. Lower = more aggressive pressing. Ligue 1 average: ~11."
        />
      </div>

      {/* ── Recent matches ─────────────────────────────────────────────────────── */}
      <div className="mb-8">
        <h2 className="type-heading-sm text-[var(--text-primary)] mb-4">Recent Matches</h2>
        <div className="space-y-3">
          {team.form.slice(0, 5).map((f) => (
            <FixtureCard
              key={f.match_id}
              matchId={f.match_id}
              homeTeamId={f.is_home ? team.team_id : 'opponent'}
              homeTeamName={f.is_home ? team.team_name : f.opponent_name}
              awayTeamId={f.is_home ? 'opponent' : team.team_id}
              awayTeamName={f.is_home ? f.opponent_name : team.team_name}
              homeGoals={f.is_home ? f.goals_for : f.goals_against}
              awayGoals={f.is_home ? f.goals_against : f.goals_for}
              homeXg={f.is_home ? (f.xg ?? undefined) : (f.xga ?? undefined)}
              awayXg={f.is_home ? (f.xga ?? undefined) : (f.xg ?? undefined)}
              status="completed"
              localDate={f.date}
            />
          ))}
        </div>
      </div>

      {/* ── Top scorers for this team ──────────────────────────────────────────── */}
      {team.top_scorers.length > 0 && (
        <div className="mb-8">
          <h2 className="type-heading-sm text-[var(--text-primary)] mb-4">Top Scorers</h2>
          <div className="card p-0 overflow-hidden">
            {team.top_scorers.map((p, i) => (
              <div
                key={p.player_id}
                className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-default)] last:border-0"
              >
                <span className="text-xs text-[var(--text-muted)] font-mono w-4 flex-shrink-0">
                  {i + 1}
                </span>
                <span className="text-sm flex-1 text-[var(--text-primary)]">{p.player_name}</span>
                <span className="text-sm font-semibold font-mono text-[var(--text-primary)]">
                  {p.goals}
                </span>
                <span className="text-xs text-[var(--text-muted)]">goals</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Full analysis CTA (Pro teaser) ─────────────────────────────────────── */}
      {!isProMode && (
        <ProLock ctaText="Unlock Full Season Analysis — Pro →" blurAmount={5}>
          <div className="card border-dashed text-center py-8">
            <p className="type-heading-sm text-[var(--text-secondary)] mb-2">
              Full Season Analysis
            </p>
            <p className="text-sm text-[var(--text-muted)]">
              Attack profile · Defensive shape · Pressing maps · Tactical fingerprint
            </p>
          </div>
        </ProLock>
      )}
    </div>
  )
}

function ordinal(n: number): string {
  const s = ['th','st','nd','rd']
  const v = n % 100
  return (s[(v-20)%10] || s[v] || s[0])
}
