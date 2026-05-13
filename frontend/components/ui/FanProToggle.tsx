'use client'

/**
 * FanProToggle — the dual-layer UX switch.
 *
 * A pill-shaped toggle with two states:
 *   Fan View  — public content, beginner-friendly
 *   Pro View  — full analytical content
 *
 * Suppresses initial render until localStorage is resolved to prevent
 * the toggle from flashing to 'fan' then snapping to 'pro'.
 *
 * Design spec:
 *   - Always visible in the top navigation
 *   - Active state uses accent-primary background with white text
 *   - Inactive state is muted text on transparent
 *   - Transition: 150ms ease (fast — feels instant)
 */

import { useViewMode, type ViewMode } from '@/contexts/ViewModeContext'
import { clsx } from 'clsx'

export function FanProToggle() {
  const { mode, setMode, isResolved } = useViewMode()

  if (!isResolved) {
    return (
      <div
        className="h-8 w-36 rounded-full skeleton"
        aria-hidden="true"
      />
    )
  }

  return (
    <div
      role="group"
      aria-label="View mode selector"
      className={`
        flex items-center
        rounded-full
        border border-[var(--border-default)]
        bg-[var(--bg-subtle)]
        p-0.5
        gap-0
      `}
    >
      <ToggleOption
        label="Fan"
        value="fan"
        current={mode}
        onSelect={setMode}
      />
      <ToggleOption
        label="Pro"
        value="pro"
        current={mode}
        onSelect={setMode}
      />
    </div>
  )
}

// ── Option button ─────────────────────────────────────────────────────────────

interface ToggleOptionProps {
  label: string
  value: ViewMode
  current: ViewMode
  onSelect: (mode: ViewMode) => void
}

function ToggleOption({ label, value, current, onSelect }: ToggleOptionProps) {
  const isActive = current === value

  return (
    <button
      onClick={() => onSelect(value)}
      role="radio"
      aria-checked={isActive}
      aria-label={`${label} view`}
      className={clsx(
        // Base styles
        'px-3 py-1 rounded-full text-sm font-medium',
        'transition-all duration-150 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-1',
        // Active state
        isActive && [
          'bg-[var(--accent-primary)] text-white',
          'shadow-sm',
        ],
        // Inactive state
        !isActive && [
          'text-[var(--text-secondary)]',
          'hover:text-[var(--text-primary)]',
          'hover:bg-[var(--bg-hover)]',
        ],
      )}
    >
      {label}
      {/* Pro label gets a subtle indicator dot when active */}
      {value === 'pro' && !isActive && (
        <span
          className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)] opacity-60"
          aria-hidden="true"
        />
      )}
    </button>
  )
}
