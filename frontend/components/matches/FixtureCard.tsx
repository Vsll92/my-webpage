'use client'

/**
 * FixtureCard — displays one fixture (upcoming or completed).
 *
 * Public mode: team names, crests, score/KO time, form strip, date
 * Pro mode:    + xG note line, pre-match report badge
 *
 * Click → navigates to match center page.
 */

import Link from 'next/link'
import { TeamBadge } from '@/components/teams/TeamBadge'
import { FormStrip } from '@/components/teams/FormStrip'
import { MetricBadge } from '@/components/ui/MetricBadge'
import { useViewMode } from '@/contexts/ViewModeContext'
import { clsx } from 'clsx'

type MatchResult = 'W' | 'D' | 'L'
type MatchStatus = 'upcoming' | 'completed' | 'live' | 'postponed'

interface FixtureCardProps {
  matchId: string
  homeTeamId: string
  homeTeamName: string
  awayTeamId: string
  awayTeamName: string
  status: MatchStatus
  kickOffTime?: string    // "21:00" — shown if upcoming
  localDate?: string      // "2026-01-18"
  homeGoals?: number | null
  awayGoals?: number | null
  homeForm?: MatchResult[]
  awayForm?: MatchResult[]
  homeXg?: number | null  // Pro: combined xG context note
  awayXg?: number | null
  week?: number
  className?: string
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  } catch {
    return dateStr
  }
}

export function FixtureCard({
  matchId,
  homeTeamId,
  homeTeamName,
  awayTeamId,
  awayTeamName,
  status,
  kickOffTime,
  localDate,
  homeGoals,
  awayGoals,
  homeForm = [],
  awayForm = [],
  homeXg,
  awayXg,
  week,
  className = '',
}: FixtureCardProps) {
  const { isProMode } = useViewMode()
  const isCompleted = status === 'completed'
  const isUpcoming  = status === 'upcoming'

  return (
    <Link
      href={`/matches/${matchId}`}
      className={clsx(
        'card block hover:shadow-elevated transition-shadow duration-150',
        'hover:border-[var(--border-strong)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]',
        className,
      )}
      aria-label={`${homeTeamName} vs ${awayTeamName}${isCompleted ? ` — ${homeGoals}–${awayGoals}` : ''}`}
    >
      <div className="flex items-center gap-3">
        {/* ── Home team ──────────────────────────────────────────── */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <TeamBadge teamId={homeTeamId} teamName={homeTeamName} size="sm" />
          <div className="min-w-0">
            <span className="text-sm font-medium text-[var(--text-primary)] truncate block">
              {homeTeamName}
            </span>
            {homeForm.length > 0 && (
              <FormStrip results={homeForm.slice(0, 5)} size="sm" className="mt-0.5" />
            )}
          </div>
        </div>

        {/* ── Score / KO time ────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-0.5 flex-shrink-0 w-16">
          {isCompleted ? (
            <div
              className="text-base font-semibold text-[var(--text-primary)] leading-none"
              style={{ fontFamily: '"DM Mono", monospace' }}
            >
              {homeGoals} – {awayGoals}
            </div>
          ) : isUpcoming ? (
            <div className="text-xs font-medium text-[var(--text-muted)] text-center">
              {kickOffTime || 'TBC'}
            </div>
          ) : (
            <MetricBadge value="PST" variant="neutral" size="xs" />
          )}

          {/* Date / week */}
          {localDate && (
            <span className="text-[10px] text-[var(--text-muted)]">
              {isCompleted ? formatDate(localDate) : `W${week ?? ''}`}
            </span>
          )}
        </div>

        {/* ── Away team ──────────────────────────────────────────── */}
        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
          <div className="min-w-0 text-right">
            <span className="text-sm font-medium text-[var(--text-primary)] truncate block">
              {awayTeamName}
            </span>
            {awayForm.length > 0 && (
              <div className="flex justify-end mt-0.5">
                <FormStrip results={awayForm.slice(0, 5)} size="sm" />
              </div>
            )}
          </div>
          <TeamBadge teamId={awayTeamId} teamName={awayTeamName} size="sm" />
        </div>
      </div>

      {/* ── Pro xG note ────────────────────────────────────────────── */}
      {isProMode && isCompleted && homeXg != null && awayXg != null && (
        <div className="mt-2 pt-2 border-t border-[var(--border-default)]">
          <span
            className="text-[11px] text-[var(--text-muted)]"
            style={{ fontFamily: '"DM Mono", monospace' }}
          >
            xG: {homeXg.toFixed(2)} – {awayXg.toFixed(2)}
          </span>
        </div>
      )}
    </Link>
  )
}
