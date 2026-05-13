/**
 * Skeleton loaders — shaped to match the components they replace.
 *
 * Rules from the blueprint:
 *   - NO spinners. Only skeleton loaders.
 *   - Each skeleton must be shaped like its real component.
 *   - Pulse animation: 1.5s ease-in-out, opacity 1→0.4→1
 *
 * Each variant is a named export. Use the correct variant per context.
 */

import { clsx } from 'clsx'

// ── Base pulse block ──────────────────────────────────────────────────────────

function Pulse({ className = '' }: { className?: string }) {
  return (
    <div
      className={clsx('skeleton rounded', className)}
      aria-hidden="true"
    />
  )
}

// ── SkeletonCard — matches the card component ─────────────────────────────────
export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={clsx('card', className)}
      aria-label="Loading..."
      aria-busy="true"
    >
      <Pulse className="h-4 w-3/4 mb-3" />
      <Pulse className="h-3 w-1/2 mb-6" />
      <Pulse className="h-8 w-full mb-2" />
      <Pulse className="h-3 w-2/3" />
    </div>
  )
}

// ── SkeletonTableRow — matches a standings or scorers table row ───────────────
export function SkeletonTableRow({
  cols = 8,
  className = '',
}: {
  cols?: number
  className?: string
}) {
  return (
    <div
      className={clsx(
        'flex items-center gap-3 py-2.5 px-4 border-b border-[var(--border-default)]',
        className,
      )}
      aria-hidden="true"
      style={{ minHeight: 44 }}
    >
      {/* Position number */}
      <Pulse className="h-4 w-5 flex-shrink-0" />
      {/* Team badge circle */}
      <Pulse className="h-7 w-7 rounded-full flex-shrink-0" />
      {/* Team name */}
      <Pulse className="h-4 flex-1 max-w-[120px]" />
      {/* Stat columns */}
      {Array.from({ length: cols - 3 }).map((_, i) => (
        <Pulse key={i} className="h-4 w-8 flex-shrink-0" />
      ))}
    </div>
  )
}

// ── SkeletonTile — matches a StatTile ─────────────────────────────────────────
export function SkeletonTile({
  size = 'md',
  className = '',
}: {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const heights = { sm: 'h-[72px]', md: 'h-[88px]', lg: 'h-[104px]' }

  return (
    <div
      className={clsx('card', heights[size], className)}
      aria-hidden="true"
    >
      <Pulse className="h-3 w-2/3 mb-3" />
      <Pulse className="h-7 w-1/2" />
    </div>
  )
}

// ── SkeletonFixtureCard — matches FixtureCard ─────────────────────────────────
export function SkeletonFixtureCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={clsx(
        'card flex items-center gap-3',
        className,
      )}
      style={{ minHeight: 72 }}
      aria-hidden="true"
    >
      {/* Home team */}
      <div className="flex items-center gap-2 flex-1">
        <Pulse className="h-9 w-9 rounded-full flex-shrink-0" />
        <Pulse className="h-4 w-20" />
      </div>
      {/* Score */}
      <Pulse className="h-6 w-12 flex-shrink-0" />
      {/* Away team */}
      <div className="flex items-center gap-2 flex-1 justify-end">
        <Pulse className="h-4 w-20" />
        <Pulse className="h-9 w-9 rounded-full flex-shrink-0" />
      </div>
    </div>
  )
}

// ── SkeletonPitch — placeholder for shot map while loading ────────────────────
export function SkeletonPitch({ className = '' }: { className?: string }) {
  return (
    <div
      className={clsx(
        'rounded-lg overflow-hidden',
        className,
      )}
      style={{
        backgroundColor: 'var(--pitch-surface)',
        aspectRatio: '105 / 68',
        opacity: 0.4,
      }}
      aria-label="Loading shot map..."
      aria-busy="true"
    />
  )
}

// ── SkeletonText — inline text loading state ──────────────────────────────────
export function SkeletonText({
  lines = 3,
  className = '',
}: {
  lines?: number
  className?: string
}) {
  return (
    <div className={clsx('space-y-2', className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Pulse
          key={i}
          className={clsx('h-4', i === lines - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  )
}

// ── SkeletonFormStrip — matches FormStrip dots ────────────────────────────────
export function SkeletonFormStrip({ n = 5 }: { n?: number }) {
  return (
    <div className="flex gap-1" aria-hidden="true">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="skeleton w-4 h-4 rounded-full" />
      ))}
    </div>
  )
}
