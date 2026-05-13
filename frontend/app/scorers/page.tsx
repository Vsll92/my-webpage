'use client'

/**
 * Top Scorers page — /scorers
 *
 * Fan mode: Rank, Player, Team, Goals, Assists, Shots, Mins
 * Pro mode: + npxG, xG/shot, Goals above xG, Big chances
 *           (Pro columns show headers but values blurred in fan mode)
 */

import { TeamBadge } from '@/components/teams/TeamBadge'
import { ProLock } from '@/components/ui/ProLock'
import { SkeletonTableRow } from '@/components/ui/Skeletons'
import { EmptyState } from '@/components/ui/EmptyState'
import { Tooltip, MetricTooltip } from '@/components/ui/Tooltip'
import { useScorers } from '@/hooks/useScorers'
import { useViewMode } from '@/contexts/ViewModeContext'
import { clsx } from 'clsx'
import Link from 'next/link'

const PRO_METRIC_TOOLTIPS = {
  npxg: {
    name: 'Non-Penalty xG (npxG)',
    definition: 'Expected goals excluding penalty kicks. A purer measure of a striker\'s quality — removes the luck of being fouled in the box.',
    methodology: 'xG sum for all shots where Penalty qualifier is absent.',
  },
  xg_per_shot: {
    name: 'xG per Shot',
    definition: 'Average shot quality. Higher values mean a player consistently gets into dangerous positions before shooting.',
    methodology: 'Total npxG ÷ total shots taken.',
  },
  goals_above_xg: {
    name: 'Goals above npxG',
    definition: 'Goals scored minus non-penalty expected goals. Positive = outperforming shot quality. Negative = underperforming chances.',
    methodology: 'Goals − npxG. Stabilises over larger shot samples.',
  },
  big_chances: {
    name: 'Big Chances',
    definition: 'Shots where the xG value is ≥ 0.35 — situations where a typical player would score roughly 1-in-3.',
    methodology: 'Count of shot events where Opta "Big Chance" qualifier is set.',
  },
}

export default function ScorersPage() {
  const { scorers, isLoading } = useScorers({ minApps: 3, limit: 30 })
  const { isProMode } = useViewMode()

  return (
    <div className="page-container py-10">
      <div className="mb-6">
        <h1 className="type-heading-lg text-[var(--text-primary)]">Top Scorers</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          France Ligue 1 · 2025–26 · Minimum 3 appearances
        </p>
      </div>

      <div className="card p-0 overflow-x-auto overflow-hidden">
        {/* ── Table header ──────────────────────────────────────────────────── */}
        <div
          className={clsx(
            'grid items-center px-4 py-2',
            'text-[11px] type-label text-[var(--text-muted)]',
            'border-b border-[var(--border-default)] bg-[var(--bg-subtle)]',
            'gap-2',
            isProMode
              ? 'grid-cols-[28px_1fr_36px_44px_40px_44px_56px_52px_60px_64px_56px]'
              : 'grid-cols-[28px_1fr_36px_44px_40px_44px_56px_52px]',
          )}
        >
          <span>#</span>
          <span>Player</span>
          <span className="text-right">Apps</span>
          <span className="text-right">Mins</span>
          <span className="text-right font-semibold text-[var(--text-primary)]">Goals</span>
          <span className="text-right">Ast</span>
          <span className="text-right">Shots</span>
          <span className="text-right">Sh/90</span>
          {isProMode && <>
            <ProColumnHeader {...PRO_METRIC_TOOLTIPS.npxg} short="npxG" />
            <ProColumnHeader {...PRO_METRIC_TOOLTIPS.xg_per_shot} short="xG/sh" />
            <ProColumnHeader {...PRO_METRIC_TOOLTIPS.goals_above_xg} short="G–xG" />
          </>}
        </div>

        {/* ── Rows ──────────────────────────────────────────────────────────── */}
        {isLoading ? (
          Array.from({ length: 15 }).map((_, i) => (
            <SkeletonTableRow key={i} cols={isProMode ? 11 : 8} />
          ))
        ) : scorers.length === 0 ? (
          <EmptyState
            heading="No scoring data yet"
            body="Player stats appear after matches have been processed. Try a different season."
            icon="list"
            className="py-12"
          />
        ) : (
          scorers.map((scorer) => (
            <div
              key={scorer.player_id}
              className={clsx(
                'grid gap-2 px-4 items-center',
                'border-b border-[var(--border-default)] last:border-0',
                'hover:bg-[var(--bg-hover)] transition-colors duration-100',
                isProMode
                  ? 'grid-cols-[28px_1fr_36px_44px_40px_44px_56px_52px_60px_64px_56px]'
                  : 'grid-cols-[28px_1fr_36px_44px_40px_44px_56px_52px]',
              )}
              style={{ minHeight: 44 }}
            >
              {/* Rank */}
              <span className="text-xs text-[var(--text-muted)] font-mono text-center">
                {scorer.rank}
              </span>

              {/* Player + team */}
              <div className="flex items-center gap-2 min-w-0">
                <TeamBadge
                  teamId={scorer.team_id}
                  teamName={scorer.team_name}
                  size="xs"
                />
                <div className="min-w-0">
                  <span className="text-sm font-medium text-[var(--text-primary)] block truncate">
                    {scorer.player_name}
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)] truncate">
                    {scorer.team_name}
                  </span>
                </div>
              </div>

              {/* Public columns */}
              {[
                scorer.matches,
                scorer.minutes,
                scorer.goals,
                scorer.assists,
                scorer.shots,
                scorer.shots_per90?.toFixed(1) ?? '—',
              ].map((v, i) => (
                <span
                  key={i}
                  className={clsx(
                    'text-right text-sm font-mono',
                    i === 2   // Goals column
                      ? 'font-semibold text-[var(--text-primary)]'
                      : 'text-[var(--text-secondary)]',
                  )}
                >
                  {v}
                </span>
              ))}

              {/* Pro columns */}
              {isProMode && (
                <>
                  <MonoCell value={scorer.npxg?.toFixed(2)} />
                  <MonoCell value={scorer.xg_per_shot?.toFixed(3)} />
                  <MonoCell
                    value={
                      scorer.goals_above_xg != null
                        ? `${scorer.goals_above_xg > 0 ? '+' : ''}${scorer.goals_above_xg.toFixed(1)}`
                        : undefined
                    }
                    positive={scorer.goals_above_xg != null && scorer.goals_above_xg > 0.5}
                    negative={scorer.goals_above_xg != null && scorer.goals_above_xg < -0.5}
                  />
                </>
              )}
            </div>
          ))
        )}
      </div>

      {/* Pro teaser for fan mode */}
      {!isProMode && (
        <div className="mt-4">
          <ProLock ctaText="See npxG, shot quality, and goals above expectation — Pro →">
            <div className="card border-dashed border-[var(--border-default)] text-center py-6">
              <p className="text-sm text-[var(--text-muted)]">
                npxG · xG per Shot · Goals above expectation · Big chances
              </p>
            </div>
          </ProLock>
        </div>
      )}

      <p className="text-xs text-[var(--text-muted)] mt-4">
        Minimum 3 appearances. Updated after each matchday.
        <Link href="/methodology" className="ml-1 text-[var(--accent-primary)] hover:underline">
          Methodology →
        </Link>
      </p>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ProColumnHeader({
  short,
  name,
  definition,
  methodology,
}: {
  short: string
  name: string
  definition: string
  methodology?: string
}) {
  return (
    <Tooltip
      content={<MetricTooltip name={name} definition={definition} methodology={methodology} />}
      side="top"
    >
      <span className="text-right text-[var(--accent-primary)] cursor-help flex items-center justify-end gap-0.5">
        {short}
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" className="opacity-60"><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></svg>
      </span>
    </Tooltip>
  )
}

function MonoCell({
  value,
  positive = false,
  negative = false,
}: {
  value?: string | null
  positive?: boolean
  negative?: boolean
}) {
  return (
    <span
      className={clsx(
        'text-right text-sm font-mono',
        positive ? 'text-[var(--accent-secondary)]' :
        negative ? 'text-[var(--accent-warning)]'   :
        'text-[var(--text-secondary)]',
      )}
    >
      {value ?? '—'}
    </span>
  )
}
