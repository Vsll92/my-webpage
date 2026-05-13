/**
 * EmptyState — shown when a page section has no data to display.
 *
 * Rules from the blueprint:
 *   - Never just "No data found."
 *   - Always: heading + body sentence + optional suggestion.
 *   - Illustrated with a faint pitch icon (not an error icon).
 *   - Muted, not alarming — the user should understand, not be worried.
 *
 * Pre-built variants cover the most common empty states in V1.
 * Use the generic EmptyState for anything not covered.
 */

import { clsx } from 'clsx'

interface EmptyStateProps {
  heading: string
  body: string
  suggestion?: string
  icon?: 'pitch' | 'chart' | 'list' | 'none'
  className?: string
}

export function EmptyState({
  heading,
  body,
  suggestion,
  icon = 'pitch',
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center gap-3 py-16 px-6 text-center',
        className,
      )}
      role="status"
      aria-label={heading}
    >
      {icon !== 'none' && (
        <div className="opacity-15 mb-2" aria-hidden="true">
          {icon === 'pitch' && <PitchIcon />}
          {icon === 'chart' && <ChartIcon />}
          {icon === 'list'  && <ListIcon />}
        </div>
      )}

      <h3 className="type-heading-sm text-[var(--text-secondary)]">
        {heading}
      </h3>
      <p className="text-sm text-[var(--text-muted)] max-w-sm leading-relaxed">
        {body}
      </p>
      {suggestion && (
        <p className="text-xs text-[var(--text-muted)] italic">
          {suggestion}
        </p>
      )}
    </div>
  )
}

// ── Pre-built variants — use these directly ───────────────────────────────────

export function NoShotsEmpty({ filter }: { filter?: string }) {
  return (
    <EmptyState
      heading="No shots in this period"
      body={
        filter
          ? `No shots recorded for ${filter}. Try expanding the filter to the full match.`
          : "No shots recorded for this filter. Try expanding the match period."
      }
      suggestion="Try: Full Match → Both Teams"
      icon="pitch"
    />
  )
}

export function NoResultsEmpty() {
  return (
    <EmptyState
      heading="Results coming soon"
      body="Matches haven't been played yet for this matchweek. Check back after the fixtures."
      icon="list"
    />
  )
}

export function NoMatchesForTeamEmpty({ teamName }: { teamName?: string }) {
  return (
    <EmptyState
      heading="No matches found"
      body={
        teamName
          ? `${teamName} hasn't played in the selected matchweek range. Try a different matchweek.`
          : "No matches found for this filter. Try a different matchweek."
      }
      icon="list"
    />
  )
}

export function TeamNotFoundEmpty() {
  return (
    <EmptyState
      heading="Team not found"
      body="We couldn't find this team in our database. Return to the team selector to choose from all 18 Ligue 1 teams."
      icon="none"
    />
  )
}

export function MatchNotFoundEmpty() {
  return (
    <EmptyState
      heading="Match not found"
      body="We couldn't find data for this match. It may not have been played yet, or the data is still being processed."
      icon="none"
    />
  )
}

export function ReportPendingEmpty() {
  return (
    <EmptyState
      heading="Report in preparation"
      body="The post-match report for this match is being prepared. Reports are typically published within 24–48 hours of the final whistle."
      icon="chart"
    />
  )
}

export function DataLoadErrorEmpty({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <EmptyState
        heading="Something went wrong"
        body="We couldn't load the data for this section. This is usually temporary."
        icon="none"
        suggestion="Check your connection and try refreshing."
      />
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-sm text-[var(--accent-primary)] hover:underline"
        >
          Try again
        </button>
      )}
    </div>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function PitchIcon() {
  return (
    <svg width="64" height="41" viewBox="0 0 64 41" fill="none"
      xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="62" height="39" rx="2"
        stroke="currentColor" strokeWidth="1.5" fill="none" />
      <line x1="32" y1="1" x2="32" y2="40"
        stroke="currentColor" strokeWidth="1" />
      <circle cx="32" cy="20.5" r="7"
        stroke="currentColor" strokeWidth="1" fill="none" />
      <rect x="1" y="12" width="10" height="17"
        stroke="currentColor" strokeWidth="1" fill="none" />
      <rect x="53" y="12" width="10" height="17"
        stroke="currentColor" strokeWidth="1" fill="none" />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg width="48" height="40" viewBox="0 0 48 40" fill="none"
      xmlns="http://www.w3.org/2000/svg">
      <path d="M4 36 L12 24 L20 28 L28 16 L36 20 L44 8"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
        strokeLinejoin="round" fill="none" />
      <line x1="4" y1="36" x2="44" y2="36"
        stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

function ListIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none"
      xmlns="http://www.w3.org/2000/svg">
      {[10, 19, 28].map((y) => (
        <g key={y}>
          <circle cx="8" cy={y} r="2" fill="currentColor" />
          <line x1="14" y1={y} x2="34" y2={y}
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      ))}
    </svg>
  )
}
