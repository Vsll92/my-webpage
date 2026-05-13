'use client'

import { use, useState } from 'react'
import { TeamBadge } from '@/components/teams/TeamBadge'
import { ProLock } from '@/components/ui/ProLock'
import { StatTile } from '@/components/ui/StatTile'
import { SkeletonCard, SkeletonPitch } from '@/components/ui/Skeletons'
import { MatchNotFoundEmpty, NoShotsEmpty } from '@/components/ui/EmptyState'
import { FilterBar } from '@/components/ui/FilterBar'
import { useMatch, useMatchShots, useXGFlow, useMatchTactical } from '@/hooks/useMatch'
import { useViewMode } from '@/contexts/ViewModeContext'
import { formatDate, formatKickOff, formatFormation } from '@/lib/formatters'
import { clsx } from 'clsx'

// Lazy-loaded visualizations
import dynamic from 'next/dynamic'
const ShotMap    = dynamic(() => import('@/components/visualizations/ShotMap'),   { ssr: false })
const XGFlowChart = dynamic(() => import('@/components/visualizations/XGFlowChart'), { ssr: false })

interface PageProps {
  params: Promise<{ matchId: string }>
}

const TABS = ['Summary', 'Shot Map', 'Formations', 'xG Flow', 'Tactical'] as const
type Tab = typeof TABS[number]

export default function MatchCenterPage({ params }: PageProps) {
  const { matchId } = use(params)
  const { match, isLoading } = useMatch(matchId)
  const { isProMode } = useViewMode()
  const [activeTab, setActiveTab] = useState<Tab>('Summary')

  if (isLoading) return <MatchSkeleton />
  if (!match)    return <div className="page-container py-16"><MatchNotFoundEmpty /></div>

  const m = match as any // typed by schema but dynamic import for brevity

  return (
    <div className="page-container py-8">

      {/* ── Scoreline hero ───────────────────────────────────────────────────── */}
      <div className="card text-center mb-6">
        <div className="flex items-center justify-center gap-6 md:gap-12">
          {/* Home team */}
          <div className="flex flex-col items-center gap-2 flex-1">
            <TeamBadge teamId={m.home_team_id} teamName={m.home_team_name} size="lg" />
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {m.home_team_name}
            </span>
          </div>

          {/* Score */}
          <div className="text-center flex-shrink-0">
            <div
              className="text-5xl font-light text-[var(--text-primary)] leading-none"
              style={{ fontFamily: '"DM Mono", monospace' }}
            >
              {m.home_goals} – {m.away_goals}
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-2 space-y-0.5">
              <div>{formatDate(m.local_date)} · {formatKickOff(m.local_time)}</div>
              {m.venue_name && <div>{m.venue_name}</div>}
              <div>Week {m.week}</div>
            </div>
          </div>

          {/* Away team */}
          <div className="flex flex-col items-center gap-2 flex-1">
            <TeamBadge teamId={m.away_team_id} teamName={m.away_team_name} size="lg" />
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {m.away_team_name}
            </span>
          </div>
        </div>

        {/* Pro xG score */}
        {isProMode && m.home_xg != null && (
          <div className="mt-4 pt-4 border-t border-[var(--border-default)]">
            <span className="text-xs text-[var(--text-muted)] font-mono">
              xG: {m.home_xg?.toFixed(2)} – {m.away_xg?.toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {/* ── Tab navigation ───────────────────────────────────────────────────── */}
      <div className="flex gap-1 mb-6 border-b border-[var(--border-default)] overflow-x-auto">
        {TABS.map((tab) => {
          const isProTab = tab === 'xG Flow' || tab === 'Tactical'
          const isActive = activeTab === tab
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={clsx(
                'px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors',
                isActive
                  ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]',
              )}
            >
              {tab}
              {isProTab && !isProMode && (
                <span className="ml-1 text-[10px] text-[var(--accent-primary)]">Pro</span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Tab content ──────────────────────────────────────────────────────── */}
      {activeTab === 'Summary' && <SummaryTab match={m} />}
      {activeTab === 'Shot Map' && <ShotMapTab matchId={matchId} match={m} />}
      {activeTab === 'Formations' && <FormationsTab match={m} />}
      {activeTab === 'xG Flow' && (
        isProMode
          ? <XGFlowTab matchId={matchId} />
          : <ProLock ctaText="xG Timeline available with Pro →">
              <div className="card py-24 text-center text-[var(--text-muted)]">xG Flow</div>
            </ProLock>
      )}
      {activeTab === 'Tactical' && (
        isProMode
          ? <TacticalTab matchId={matchId} match={m} />
          : <ProLock ctaText="Tactical analysis available with Pro →">
              <div className="card py-24 text-center text-[var(--text-muted)]">Tactical</div>
            </ProLock>
      )}
    </div>
  )
}

// ── Summary Tab ───────────────────────────────────────────────────────────────
function SummaryTab({ match: m }: { match: any }) {
  const facts = m.facts ?? {}
  const stats = m.stats ?? {}

  return (
    <div className="space-y-6">
      {/* Match facts */}
      {facts.goals?.length > 0 && (
        <div className="card">
          <h3 className="type-heading-sm text-[var(--text-primary)] mb-4">Goals</h3>
          {facts.goals.map((g: any, i: number) => (
            <div key={i} className="flex items-center gap-2 py-1.5 text-sm">
              <span className="w-8 text-right font-mono text-[var(--text-muted)]">{g.minute}&apos;</span>
              <span className="text-[var(--text-primary)]">{g.player_name}</span>
              {g.is_penalty && <span className="text-xs text-[var(--text-muted)]">(pen)</span>}
              {g.is_own_goal && <span className="text-xs text-[var(--text-muted)]">(og)</span>}
            </div>
          ))}
        </div>
      )}

      {/* Stats comparison */}
      <div className="card">
        <h3 className="type-heading-sm text-[var(--text-primary)] mb-4">Match Stats</h3>
        <div className="space-y-2">
          {[
            ['Shots',           stats.home_shots,          stats.away_shots],
            ['Shots on Target', stats.home_shots_on_target, stats.away_shots_on_target],
            ['Passes',          stats.home_passes,          stats.away_passes],
            ['Pass %',          `${stats.home_pass_pct?.toFixed(0)}%`, `${stats.away_pass_pct?.toFixed(0)}%`],
            ['Corners',         stats.home_corners,         stats.away_corners],
            ['Fouls',           stats.home_fouls,           stats.away_fouls],
          ].map(([label, home, away]) => (
            <div key={label as string} className="flex items-center gap-3 text-sm">
              <span className="w-10 text-right font-mono text-[var(--text-primary)]">{home}</span>
              <span className="flex-1 text-center text-xs text-[var(--text-muted)]">{label}</span>
              <span className="w-10 text-left font-mono text-[var(--text-primary)]">{away}</span>
            </div>
          ))}
          {/* Possession bar */}
          <div className="pt-2">
            <div className="flex items-center gap-3 text-sm mb-1">
              <span className="w-10 text-right font-mono text-[var(--text-primary)]">
                {stats.home_possession?.toFixed(0)}%
              </span>
              <span className="flex-1 text-center text-xs text-[var(--text-muted)]">Possession</span>
              <span className="w-10 text-left font-mono text-[var(--text-primary)]">
                {stats.away_possession?.toFixed(0)}%
              </span>
            </div>
            <div className="flex h-1.5 rounded-full overflow-hidden bg-[var(--bg-subtle)]">
              <div
                className="bg-[var(--accent-primary)]"
                style={{ width: `${stats.home_possession ?? 50}%` }}
              />
            </div>
            <p className="text-[10px] text-[var(--text-muted)] mt-1">
              Possession estimated from pass count. See Methodology for details.
            </p>
          </div>
        </div>
      </div>

      {/* Cards */}
      {facts.cards?.length > 0 && (
        <div className="card">
          <h3 className="type-heading-sm text-[var(--text-primary)] mb-3">Cards</h3>
          {facts.cards.map((c: any, i: number) => (
            <div key={i} className="flex items-center gap-2 py-1 text-sm">
              <span className="w-8 text-right font-mono text-[var(--text-muted)]">{c.minute}&apos;</span>
              <div
                className="w-3 h-4 rounded-sm flex-shrink-0"
                style={{
                  backgroundColor:
                    c.card_type === 'red' || c.card_type === 'second_yellow'
                      ? 'var(--accent-warning)'
                      : 'var(--accent-amber)',
                }}
              />
              <span className="text-[var(--text-primary)]">{c.player_name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Shot Map Tab ──────────────────────────────────────────────────────────────
function ShotMapTab({ matchId, match: m }: { matchId: string; match: any }) {
  const [periodFilter, setPeriodFilter] = useState<'all' | '1' | '2'>('all')
  const [teamFilter,   setTeamFilter]   = useState<'all' | 'home' | 'away'>('all')
  const { shots, isLoading } = useMatchShots(matchId, {
    period: periodFilter,
    team:   teamFilter,
  })

  return (
    <div className="card space-y-4">
      <FilterBar
        filters={[
          {
            id: 'period',
            options: [
              { value: 'all', label: 'Full Match' },
              { value: '1',   label: '1st Half' },
              { value: '2',   label: '2nd Half' },
            ],
            value: periodFilter,
            onChange: (v) => setPeriodFilter(v as any),
          },
          {
            id: 'team',
            options: [
              { value: 'all',  label: 'Both Teams' },
              { value: 'home', label: m.home_team_name },
              { value: 'away', label: m.away_team_name },
            ],
            value: teamFilter,
            onChange: (v) => setTeamFilter(v as any),
          },
        ]}
      />

      {isLoading ? (
        <SkeletonPitch />
      ) : shots.length === 0 ? (
        <NoShotsEmpty />
      ) : (
        <ShotMap shots={shots} homeTeamId={m.home_team_id} awayTeamId={m.away_team_id} />
      )}
    </div>
  )
}

// ── Formations Tab ────────────────────────────────────────────────────────────
function FormationsTab({ match: m }: { match: any }) {
  return (
    <div className="card">
      <div className="grid grid-cols-2 gap-8">
        {[
          { name: m.home_team_name, formation: m.home_formation, lineup: m.home_lineup, isHome: true },
          { name: m.away_team_name, formation: m.away_formation, lineup: m.away_lineup, isHome: false },
        ].map(({ name, formation, lineup, isHome }) => (
          <div key={name}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-medium text-[var(--text-primary)]">{name}</span>
              {formation && (
                <span className="text-xs text-[var(--text-muted)] font-mono">
                  {formatFormation(formation)}
                </span>
              )}
            </div>
            {lineup?.length > 0 ? (
              <div className="space-y-1">
                {lineup
                  .filter((p: any) => p.is_starter)
                  .map((p: any) => (
                    <div key={p.player_id} className="flex items-center gap-2 text-xs">
                      <span className="text-[var(--text-muted)] w-4 text-right">{p.jersey_number ?? '—'}</span>
                      <span className="text-[var(--text-secondary)]">{p.position ?? ''}</span>
                      <span className="text-[var(--text-primary)]">{p.player_name}</span>
                      {p.sub_off_minute && (
                        <span className="text-[var(--accent-warning)] ml-auto">{p.sub_off_minute}&apos;</span>
                      )}
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)]">Lineup data not available.</p>
            )}
          </div>
        ))}
      </div>

      {/* Subs */}
      {m.facts?.substitutions?.length > 0 && (
        <div className="mt-6 pt-4 border-t border-[var(--border-default)]">
          <h4 className="text-xs type-label text-[var(--text-muted)] mb-3">Substitutions</h4>
          <div className="space-y-1.5">
            {m.facts.substitutions.map((s: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <span className="font-mono text-[var(--text-muted)] w-8">{s.minute}&apos;</span>
                <span className="text-[var(--accent-secondary)]">↑</span>
                <span>{s.player_on}</span>
                <span className="text-[var(--text-muted)]">for</span>
                <span className="text-[var(--accent-warning)]">↓</span>
                <span>{s.player_off}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── xG Flow Tab (Pro) ────────────────────────────────────────────────────────
function XGFlowTab({ matchId }: { matchId: string }) {
  const { xgFlow, isLoading } = useXGFlow(matchId)

  if (isLoading) return <SkeletonCard className="h-64" />
  if (!xgFlow)   return <div className="card text-center py-8 text-[var(--text-muted)]">No xG data available.</div>

  return (
    <div className="card space-y-4">
      <XGFlowChart
        homeTeamId={xgFlow.home_team_id}
        awayTeamId={xgFlow.away_team_id}
        homeTeamName={xgFlow.home_team_name}
        awayTeamName={xgFlow.away_team_name}
        homeData={xgFlow.home_xg_by_minute}
        awayData={xgFlow.away_xg_by_minute}
        goals={xgFlow.goals}
      />
      <p className="text-xs text-[var(--text-muted)]">
        Cumulative expected goals across the match. Steeper sections = periods of high chance
        creation. Goal icons mark actual goals — a team can have more xG than goals if they
        missed big chances.
      </p>
    </div>
  )
}

// ── Tactical Tab (Pro) ───────────────────────────────────────────────────────
function TacticalTab({ matchId, match: m }: { matchId: string; match: any }) {
  const { tactical, isLoading } = useMatchTactical(matchId)

  if (isLoading) return <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    {Array.from({ length: 6 }).map((_, i) => <SkeletonTile key={i} size="sm" />)}
  </div>

  const t = tactical as any

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="Home PPDA"  value={t?.home_ppda}  format="decimal1"
          tooltip="Passes Per Defensive Action for the home team. Lower = more aggressive press." />
        <StatTile label="Away PPDA"  value={t?.away_ppda}  format="decimal1"
          tooltip="Passes Per Defensive Action for the away team." />
        <StatTile label="Home Def. Height" value={t?.home_def_height} format="decimal1"
          tooltip="Average x-coordinate of home team defensive actions (0–100). Higher = defending further up." />
        <StatTile label="Away Def. Height" value={t?.away_def_height} format="decimal1"
          tooltip="Average x-coordinate of away team defensive actions." />
        <StatTile label="Home Prog. Passes" value={t?.home_progressive_passes} format="integer"
          tooltip="Completed passes advancing the ball ≥10 units toward the opponent goal." />
        <StatTile label="Away Prog. Passes" value={t?.away_progressive_passes} format="integer"
          tooltip="Completed passes advancing the ball ≥10 units toward the opponent goal." />
        <StatTile label="Home Box Entries" value={t?.home_box_entries} format="integer"
          tooltip="Completed passes whose endpoint landed inside the penalty box." />
        <StatTile label="Away Box Entries" value={t?.away_box_entries} format="integer"
          tooltip="Completed passes whose endpoint landed inside the penalty box." />
      </div>
    </div>
  )
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
function MatchSkeleton() {
  return (
    <div className="page-container py-8 space-y-4">
      <SkeletonCard className="h-40" />
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} className="h-24" />)}
      </div>
    </div>
  )
}
