'use client'

/**
 * Standings page — /standings
 *
 * Full 18-team Ligue 1 table.
 * Fan mode:  standard columns + form.
 * Pro mode:  + xG For, xG Against, xG Delta.
 */

import { TeamBadge } from '@/components/teams/TeamBadge'
import { FormStrip } from '@/components/teams/FormStrip'
import { SkeletonTableRow } from '@/components/ui/Skeletons'
import { DataLoadErrorEmpty, EmptyState } from '@/components/ui/EmptyState'
import { useStandings, type StandingRow } from '@/hooks/useStandings'
import { useViewMode } from '@/contexts/ViewModeContext'
import { clsx } from 'clsx'
import Link from 'next/link'

// ── Zone config (left-border colour per league position) ─────────────────────
const ZONE: Record<number, { color: string; label: string }> = {
  1:  { color: 'var(--zone-champions)',  label: 'Champions League' },
  2:  { color: 'var(--zone-champions)',  label: 'Champions League' },
  3:  { color: 'var(--zone-champions)',  label: 'Champions League' },
  4:  { color: 'var(--zone-europa)',     label: 'Europa League' },
  16: { color: 'var(--zone-relegation)', label: 'Relegation play-off' },
  17: { color: 'var(--zone-relegation)', label: 'Relegation' },
  18: { color: 'var(--zone-relegation)', label: 'Relegation' },
}

// ── Grid column definitions ───────────────────────────────────────────────────
const COLS_FAN = 'grid-cols-[28px_1fr_32px_32px_32px_32px_48px_48px_36px_44px_80px]'
const COLS_PRO = 'grid-cols-[28px_1fr_32px_32px_32px_32px_48px_48px_36px_44px_80px_52px_52px_52px]'

// ── Page ──────────────────────────────────────────────────────────────────────

export default function StandingsPage() {
  const { standings, isLoading, error, mutate } = useStandings()
  const { isProMode } = useViewMode()

  const cols = isProMode ? COLS_PRO : COLS_FAN

  return (
    <div className="page-container py-10">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="type-heading-lg text-[var(--text-primary)]">Standings</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          France Ligue 1 · 2025–26
        </p>
      </div>

      {/* ── Table card ─────────────────────────────────────────────────────── */}
      <div className="card p-0 overflow-hidden">

        {/* Table header */}
        <div className={clsx(
          'grid gap-2 px-4 py-2',
          'text-[11px] type-label text-[var(--text-muted)]',
          'border-b border-[var(--border-default)] bg-[var(--bg-subtle)]',
          cols,
        )}>
          <span className="text-center">#</span>
          <span>Club</span>
          <span className="text-right">P</span>
          <span className="text-right">W</span>
          <span className="text-right">D</span>
          <span className="text-right">L</span>
          <span className="text-right">GF</span>
          <span className="text-right">GA</span>
          <span className="text-right">GD</span>
          <span className="text-right font-semibold">Pts</span>
          <span>Form</span>
          {isProMode && (
            <>
              <span className="text-right text-[var(--accent-primary)]">xGF</span>
              <span className="text-right text-[var(--accent-primary)]">xGA</span>
              <span className="text-right text-[var(--accent-primary)]">Δ xG</span>
            </>
          )}
        </div>

        {/* Table body — three states: loading / error / data */}
        {isLoading ? (
          /* Skeletons */
          <>
            {Array.from({ length: 18 }).map((_, i) => (
              <SkeletonTableRow key={i} cols={isProMode ? 14 : 11} />
            ))}
          </>

        ) : error ? (
          /* Error state — shown when CORS, network, or API failure occurs */
          <div className="py-8 px-4">
            <DataLoadErrorEmpty onRetry={() => mutate()} />
            {/* Show the actual error message in development so bugs are obvious */}
            {process.env.NODE_ENV === 'development' && (
              <p className="mt-3 text-center text-xs font-mono text-[var(--accent-warning)]">
                {error instanceof Error ? error.message : String(error)}
              </p>
            )}
          </div>

        ) : standings.length === 0 ? (
          /* Empty state — only reached if API returns rows:[] */
          <EmptyState
            heading="No standings data"
            body="Standings will appear once matches have been processed."
            icon="list"
            className="py-12"
          />

        ) : (
          /* Real data */
          standings.map((row) => (
            <StandingsRow key={row.team_id} row={row} isProMode={isProMode} cols={cols} />
          ))
        )}
      </div>

      {/* ── Zone legend ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-6 mt-4 flex-wrap">
        {[
          { color: 'var(--zone-champions)',  label: 'Champions League' },
          { color: 'var(--zone-europa)',     label: 'Europa League' },
          { color: 'var(--zone-relegation)', label: 'Relegation' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
            <span className="text-xs text-[var(--text-muted)]">{label}</span>
          </div>
        ))}
      </div>

      {/* ── Pro methodology note ────────────────────────────────────────────── */}
      {isProMode && (
        <p className="text-xs text-[var(--text-muted)] mt-3">
          xGF/xGA: Expected Goals For/Against based on shot quality.
          Δ xG: Goals minus npxG — positive means scoring above expectation.{' '}
          <Link href="/methodology" className="text-[var(--accent-primary)] hover:underline">
            Methodology →
          </Link>
        </p>
      )}
    </div>
  )
}

// ── Row component ─────────────────────────────────────────────────────────────

function StandingsRow({
  row,
  isProMode,
  cols,
}: {
  row: StandingRow
  isProMode: boolean
  cols: string
}) {
  const zone = ZONE[row.position]

  return (
    <Link
      href={`/teams/${row.team_id}`}
      className={clsx(
        'grid gap-2 px-4 items-center',
        'border-b border-[var(--border-default)] last:border-0',
        'hover:bg-[var(--bg-hover)] transition-colors duration-100',
        'focus-visible:outline-none focus-visible:bg-[var(--bg-hover)]',
        cols,
      )}
      style={{
        minHeight: 44,
        // Zone colour as inset left border — avoids layout shift
        boxShadow: zone ? `inset 3px 0 0 ${zone.color}` : undefined,
      }}
      title={zone?.label}
    >
      {/* # */}
      <span className="text-center text-xs text-[var(--text-muted)] font-mono">
        {row.position}
      </span>

      {/* Club name + badge */}
      <div className="flex items-center gap-2 min-w-0">
        <TeamBadge teamId={row.team_id} teamName={row.team_name} size="xs" />
        <span className="text-sm font-medium text-[var(--text-primary)] truncate">
          {row.team_name}
        </span>
      </div>

      {/* Standard integer columns */}
      {[row.played, row.won, row.drawn, row.lost, row.goals_for, row.goals_against].map((v, i) => (
        <span
          key={i}
          className="text-right text-sm text-[var(--text-secondary)] font-mono"
        >
          {v}
        </span>
      ))}

      {/* GD — coloured */}
      <span
        className={clsx(
          'text-right text-sm font-mono',
          row.goal_diff > 0 ? 'text-[var(--accent-secondary)]' :
          row.goal_diff < 0 ? 'text-[var(--accent-warning)]' :
          'text-[var(--text-secondary)]',
        )}
      >
        {row.goal_diff > 0 ? '+' : ''}{row.goal_diff}
      </span>

      {/* Points — bold */}
      <span className="text-right text-sm font-semibold text-[var(--text-primary)] font-mono">
        {row.points}
      </span>

      {/* Form strip */}
      <div className="flex items-center">
        <FormStrip results={row.form} size="sm" />
      </div>

      {/* Pro columns */}
      {isProMode && (
        <>
          <span className="text-right text-sm text-[var(--accent-primary)] font-mono">
            {row.xg_for?.toFixed(1) ?? '—'}
          </span>
          <span className="text-right text-sm text-[var(--accent-primary)] font-mono">
            {row.xg_against?.toFixed(1) ?? '—'}
          </span>
          <span
            className={clsx(
              'text-right text-sm font-mono',
              (row.xg_delta ?? 0) > 0.5  ? 'text-[var(--accent-secondary)]' :
              (row.xg_delta ?? 0) < -0.5 ? 'text-[var(--accent-warning)]' :
              'text-[var(--text-secondary)]',
            )}
          >
            {row.xg_delta != null
              ? `${row.xg_delta > 0 ? '+' : ''}${row.xg_delta.toFixed(1)}`
              : '—'}
          </span>
        </>
      )}
    </Link>
  )
}
