'use client'

/**
 * MatchweekNavigator — prev/next week navigation control.
 *
 * Renders: ← | Week 21 | →
 * Disables ← at minWeek, → at maxWeek.
 */

interface MatchweekNavigatorProps {
  currentWeek: number
  minWeek?: number
  maxWeek?: number
  onChange: (week: number) => void
  className?: string
}

export function MatchweekNavigator({
  currentWeek,
  minWeek = 1,
  maxWeek = 34,
  onChange,
  className = '',
}: MatchweekNavigatorProps) {
  const canPrev = currentWeek > minWeek
  const canNext = currentWeek < maxWeek

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <NavButton
        onClick={() => onChange(currentWeek - 1)}
        disabled={!canPrev}
        direction="prev"
        aria-label="Previous matchweek"
      />
      <span
        className="text-sm font-medium text-[var(--text-primary)] min-w-[80px] text-center select-none"
      >
        Week {currentWeek}
      </span>
      <NavButton
        onClick={() => onChange(currentWeek + 1)}
        disabled={!canNext}
        direction="next"
        aria-label="Next matchweek"
      />
    </div>
  )
}

function NavButton({
  onClick,
  disabled,
  direction,
  'aria-label': ariaLabel,
}: {
  onClick: () => void
  disabled: boolean
  direction: 'prev' | 'next'
  'aria-label': string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`
        w-8 h-8 rounded-md flex items-center justify-center
        border border-[var(--border-default)]
        text-[var(--text-secondary)]
        hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]
        disabled:opacity-30 disabled:cursor-not-allowed
        transition-colors duration-150
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]
      `}
    >
      {direction === 'prev' ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      )}
    </button>
  )
}
