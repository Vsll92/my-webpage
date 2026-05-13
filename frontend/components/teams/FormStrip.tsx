'use client'

/**
 * FormStrip — renders N colored dots showing recent match results.
 *
 * W = green (#36B37E)
 * D = grey  (--text-muted)
 * L = red   (#FF5630)
 *
 * Left = oldest result, Right = most recent.
 *
 * Design rules:
 *   - Max 10 dots (last 10 matches)
 *   - Default 5 dots (last 5 matches — used on fixture cards, standings)
 *   - Tooltip on each dot: opponent and score (if available)
 *   - Size variants: sm (12px), md (16px), lg (20px)
 */

import { clsx } from 'clsx'

type MatchResult = 'W' | 'D' | 'L'

interface FormEntry {
  result: MatchResult
  opponentName?: string
  goalsFor?: number
  goalsAgainst?: number
}

interface FormStripProps {
  // Either simple result strings or full form entries with tooltips
  results: MatchResult[] | FormEntry[]
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

const SIZES = {
  sm: 'w-3 h-3',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
}

const RESULT_COLORS: Record<MatchResult, string> = {
  W: 'var(--accent-secondary)',   // green
  D: 'var(--text-muted)',          // grey
  L: 'var(--accent-warning)',      // red
}

function isFormEntry(item: MatchResult | FormEntry): item is FormEntry {
  return typeof item === 'object' && 'result' in item
}

export function FormStrip({
  results,
  size = 'md',
  showLabel = false,
  className = '',
}: FormStripProps) {
  if (!results || results.length === 0) return null

  const dotSize = SIZES[size]

  return (
    <div className={clsx('flex items-center gap-1', className)}>
      {showLabel && (
        <span className="text-[10px] text-[var(--text-muted)] mr-0.5 uppercase tracking-wide font-medium">
          Form
        </span>
      )}

      {results.map((item, index) => {
        const result: MatchResult = isFormEntry(item) ? item.result : item
        const entry: FormEntry | null = isFormEntry(item) ? item : null

        const tooltipContent = entry && entry.opponentName
          ? `vs ${entry.opponentName} — ${entry.goalsFor ?? '?'}–${entry.goalsAgainst ?? '?'} (${result})`
          : undefined

        return (
          <ResultDot
            key={index}
            result={result}
            sizeClass={dotSize}
            tooltip={tooltipContent}
            position={index}
            total={results.length}
          />
        )
      })}
    </div>
  )
}

// ── Individual result dot ─────────────────────────────────────────────────────

interface ResultDotProps {
  result: MatchResult
  sizeClass: string
  tooltip?: string
  position: number
  total: number
}

function ResultDot({ result, sizeClass, tooltip }: ResultDotProps) {
  const dot = (
    <div
      className={clsx(
        'rounded-full flex-shrink-0',
        sizeClass,
        tooltip && 'cursor-default',
      )}
      style={{ backgroundColor: RESULT_COLORS[result] }}
      aria-label={result === 'W' ? 'Win' : result === 'D' ? 'Draw' : 'Loss'}
      title={tooltip}
    />
  )

  return dot
}

// ── FormStripSkeleton (exported for use in loading states) ────────────────────
export function FormStripSkeleton({ n = 5, size = 'md' }: { n?: number; size?: 'sm' | 'md' | 'lg' }) {
  const dotSize = SIZES[size]
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: n }).map((_, i) => (
        <div
          key={i}
          className={clsx('rounded-full skeleton', dotSize)}
        />
      ))}
    </div>
  )
}
