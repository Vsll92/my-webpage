'use client'

/**
 * StatTile — a single metric display tile.
 *
 * Used on:
 *   - Team page season summary (Goals, xG, Shots/90, PPDA, etc.)
 *   - Match center Tactical tab (home/away PPDA, def height)
 *   - Homepage top performers row
 *
 * In Fan mode with isPro=true: renders a ProLock blur overlay.
 * In Pro mode: always shows full content.
 *
 * Design rules:
 *   - Label in small muted text above
 *   - Value in DM Mono, large, primary color
 *   - Optional delta badge (green/red for positive/negative)
 *   - Optional info icon that opens a tooltip on hover
 */

import { type ReactNode } from 'react'
import { clsx } from 'clsx'
import { ProLock } from './ProLock'
import { Tooltip } from './Tooltip'

interface StatTileProps {
  label: string
  value: string | number | null | undefined
  unit?: string                // appended after value: "14.2 shots"
  delta?: number               // positive = green badge, negative = red badge
  tooltip?: string             // shown on info icon hover
  isPro?: boolean              // if true and fan mode active, blur and lock
  format?: 'integer' | 'decimal1' | 'decimal2' | 'decimal3' | 'percent'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

function formatValue(
  value: string | number | null | undefined,
  format: StatTileProps['format']
): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string') return value
  if (!isFinite(value)) return '—'
  switch (format) {
    case 'integer':   return Math.round(value).toString()
    case 'decimal1':  return value.toFixed(1)
    case 'decimal2':  return value.toFixed(2)
    case 'decimal3':  return value.toFixed(3)
    case 'percent':   return `${value.toFixed(1)}%`
    default:          return typeof value === 'number' ? value.toFixed(1) : String(value)
  }
}

const SIZE_CLASSES = {
  sm: { value: 'text-xl',     label: 'text-[11px]', tile: 'p-3' },
  md: { value: 'text-2xl',    label: 'text-xs',     tile: 'p-4' },
  lg: { value: 'text-[2rem]', label: 'text-sm',     tile: 'p-5' },
} as const

export function StatTile({
  label,
  value,
  unit,
  delta,
  tooltip,
  isPro = false,
  format = 'decimal1',
  size = 'md',
  className = '',
}: StatTileProps) {
  const sc = SIZE_CLASSES[size]
  const displayValue = formatValue(value, format)

  const tileContent = (
    <div
      className={clsx(
        'card flex flex-col gap-1.5',
        sc.tile,
        className,
      )}
    >
      {/* Label row */}
      <div className="flex items-center gap-1.5">
        <span
          className={clsx(sc.label, 'font-medium text-[var(--text-muted)] uppercase tracking-wide')}
        >
          {label}
        </span>
        {tooltip && (
          <Tooltip content={tooltip}>
            <InfoIcon />
          </Tooltip>
        )}
      </div>

      {/* Value row */}
      <div className="flex items-baseline gap-1.5">
        <span
          className={clsx(
            sc.value,
            'font-normal text-[var(--text-primary)] leading-none'
          )}
          style={{ fontFamily: '"DM Mono", monospace', fontVariantNumeric: 'tabular-nums' }}
        >
          {displayValue}
        </span>
        {unit && (
          <span className="text-xs text-[var(--text-muted)]">{unit}</span>
        )}
        {delta !== undefined && delta !== null && (
          <DeltaBadge value={delta} />
        )}
      </div>
    </div>
  )

  if (isPro) {
    return (
      <ProLock ctaText="Unlock Pro →" blurAmount={4} minHeight={80}>
        {tileContent}
      </ProLock>
    )
  }

  return tileContent
}

// ── Delta badge ───────────────────────────────────────────────────────────────

function DeltaBadge({ value }: { value: number }) {
  const isPositive = value > 0
  const isNeutral  = value === 0

  return (
    <span
      className={clsx(
        'inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium font-mono',
        isNeutral  && 'text-[var(--text-muted)] bg-[var(--bg-subtle)]',
        isPositive && 'text-[var(--accent-secondary)] bg-[var(--accent-secondary)] bg-opacity-10',
        !isPositive && !isNeutral && 'text-[var(--accent-warning)] bg-[var(--accent-warning)] bg-opacity-10',
      )}
    >
      {isPositive ? '+' : ''}{value.toFixed(1)}
    </span>
  )
}

// ── Info icon ─────────────────────────────────────────────────────────────────

function InfoIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-[var(--text-muted)] cursor-help flex-shrink-0"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8"  x2="12.01" y2="8" />
    </svg>
  )
}
