'use client'

/**
 * FilterBar — a row of filter chips with an optional reset button.
 *
 * Design rules:
 *   - Filters update the view immediately (no "Apply" button).
 *   - "Reset" link appears only when non-default filters are active.
 *   - Active filter chip: accent primary background + white text.
 *   - Inactive chip: border + secondary text.
 *   - Maximum 3 filters visible in public mode; advanced filters collapse.
 *
 * Usage:
 *   <FilterBar
 *     filters={[
 *       { id: 'period', label: 'Period',
 *         options: [{ value: 'all', label: 'Full Match' }, { value: '1', label: '1st Half' }],
 *         value: 'all', onChange: setPeriod }
 *     ]}
 *     onReset={() => { setPeriod('all') }}
 *   />
 */

import { clsx } from 'clsx'

interface FilterOption {
  value: string
  label: string
}

interface FilterDef {
  id: string
  label?: string          // Optional group label above chips (omit for compact rows)
  options: FilterOption[]
  value: string
  onChange: (value: string) => void
}

interface FilterBarProps {
  filters: FilterDef[]
  onReset?: () => void
  showReset?: boolean       // Whether to show the reset button
  className?: string
}

export function FilterBar({
  filters,
  onReset,
  showReset = false,
  className = '',
}: FilterBarProps) {
  return (
    <div className={clsx('flex items-center gap-3 flex-wrap', className)}>
      {filters.map((filter, index) => (
        <div key={filter.id} className="flex items-center gap-1.5">
          {filter.label && (
            <span className="text-xs text-[var(--text-muted)] font-medium mr-0.5">
              {filter.label}:
            </span>
          )}
          {filter.options.map((option) => (
            <FilterChip
              key={option.value}
              label={option.label}
              isActive={filter.value === option.value}
              onClick={() => filter.onChange(option.value)}
            />
          ))}
          {/* Divider between filter groups */}
          {index < filters.length - 1 && (
            <div
              className="w-px h-4 bg-[var(--border-default)] mx-1"
              aria-hidden="true"
            />
          )}
        </div>
      ))}

      {showReset && onReset && (
        <button
          onClick={onReset}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--accent-primary)]
                     transition-colors duration-150 underline underline-offset-2 ml-1"
        >
          Reset
        </button>
      )}
    </div>
  )
}

// ── Individual filter chip ────────────────────────────────────────────────────

interface FilterChipProps {
  label: string
  isActive: boolean
  onClick: () => void
  disabled?: boolean
}

export function FilterChip({ label, isActive, onClick, disabled = false }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'px-3 py-1 text-sm rounded-full border',
        'transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        isActive
          ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
          : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]',
      )}
    >
      {label}
    </button>
  )
}
