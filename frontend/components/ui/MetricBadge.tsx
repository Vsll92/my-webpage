/**
 * MetricBadge — small colored badge for result context and metric annotations.
 *
 * Variants:
 *   positive  — green (goals, positive xG delta, wins)
 *   negative  — red   (xG against, losses, negative deltas)
 *   neutral   — grey  (draws, zero values)
 *   warning   — amber (caution states)
 *   pro       — sapphire with opacity background (Pro feature labels)
 *   result-W  — win badge (green fill)
 *   result-D  — draw badge (grey fill)
 *   result-L  — loss badge (red fill)
 *
 * Used on:
 *   - Form strips (W/D/L dots) — via FormStrip component
 *   - Result cards ("Fortunate", "Deserved", "Comfortable")
 *   - Team page xG delta badge
 *   - Standings zone border labels
 */

import { clsx } from 'clsx'

type BadgeVariant =
  | 'positive'
  | 'negative'
  | 'neutral'
  | 'warning'
  | 'pro'
  | 'result-W'
  | 'result-D'
  | 'result-L'

interface MetricBadgeProps {
  value: string
  variant: BadgeVariant
  size?: 'xs' | 'sm' | 'md'
  className?: string
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  positive:  'text-[var(--accent-secondary)] bg-[var(--accent-secondary)] bg-opacity-10',
  negative:  'text-[var(--accent-warning)] bg-[var(--accent-warning)] bg-opacity-10',
  neutral:   'text-[var(--text-muted)] bg-[var(--bg-subtle)]',
  warning:   'text-[var(--accent-amber)] bg-[var(--accent-amber)] bg-opacity-10',
  pro:       'text-[var(--pro-text)] bg-[var(--pro-bg)] border border-[var(--pro-border)]',
  'result-W': 'text-white bg-[var(--accent-secondary)]',
  'result-D': 'text-white bg-[var(--text-muted)]',
  'result-L': 'text-white bg-[var(--accent-warning)]',
}

const SIZE_CLASSES = {
  xs: 'px-1 py-0.5 text-[10px] rounded',
  sm: 'px-1.5 py-0.5 text-xs rounded-md',
  md: 'px-2 py-1 text-sm rounded-md',
}

export function MetricBadge({
  value,
  variant,
  size = 'sm',
  className = '',
}: MetricBadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center font-medium',
        SIZE_CLASSES[size],
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {value}
    </span>
  )
}
