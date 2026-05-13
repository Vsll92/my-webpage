'use client'

/**
 * ProLock — wraps Pro-gated content with a blur overlay in Fan mode.
 *
 * Critical design rule from the blueprint:
 *   "Pro content is blurred/teased, never hidden."
 *   Users always see what they are missing. The content is visible
 *   through a soft blur — not replaced with a blank card.
 *
 * Usage:
 *   <ProLock ctaText="Unlock xG sizing — Pro">
 *     <ShotMap shots={shots} />
 *   </ProLock>
 *
 * In Pro mode: renders children directly with no wrapper.
 * In Fan mode: renders blurred children + overlay with CTA.
 */

import { type ReactNode } from 'react'
import { useViewMode } from '@/contexts/ViewModeContext'

interface ProLockProps {
  children: ReactNode
  ctaText?: string      // CTA button label
  ctaHref?: string      // Where the CTA links to (default: /pro)
  blurAmount?: number   // Blur strength in px (default: 6)
  minHeight?: number    // Minimum height for the container in px (ensures overlay has room)
  className?: string
}

export function ProLock({
  children,
  ctaText = 'Unlock Pro →',
  ctaHref = '/pro',
  blurAmount = 6,
  minHeight,
  className = '',
}: ProLockProps) {
  const { isProMode, isResolved } = useViewMode()

  // In Pro mode: render children directly — no wrapper, no overhead
  if (isProMode) {
    return <>{children}</>
  }

  // During SSR/hydration: render children without blur to avoid mismatch.
  // The blur is applied client-side after isResolved = true.
  // Users with Fan mode see a very brief flash of unblurred content — acceptable.
  if (!isResolved) {
    return <div className={className}>{children}</div>
  }

  // Fan mode: blur the content and show upgrade overlay
  return (
    <div
      className={`relative overflow-hidden rounded-[var(--radius-lg)] ${className}`}
      style={minHeight ? { minHeight } : undefined}
    >
      {/* Blurred content — always rendered, never hidden */}
      <div
        aria-hidden="true"
        style={{
          filter: `blur(${blurAmount}px)`,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {children}
      </div>

      {/* Upgrade overlay */}
      <div
        className={`
          absolute inset-0
          flex flex-col items-center justify-center gap-3
          rounded-[var(--radius-lg)]
          bg-[var(--bg-surface)] bg-opacity-85
          backdrop-blur-[2px]
          z-10
        `}
      >
        {/* Lock icon */}
        <div className="text-[var(--text-muted)]">
          <LockIcon />
        </div>

        {/* Label */}
        <span className="text-sm text-[var(--text-secondary)]">
          Pro
        </span>

        {/* CTA button */}
        <a
          href={ctaHref}
          className={`
            inline-flex items-center gap-1.5
            px-4 py-2
            text-sm font-medium
            rounded-[var(--radius-md)]
            border border-[var(--pro-border)]
            bg-[var(--pro-bg)]
            text-[var(--pro-text)]
            hover:bg-[var(--accent-primary)] hover:text-white hover:border-[var(--accent-primary)]
            transition-colors duration-150
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]
          `}
        >
          {ctaText}
        </a>
      </div>
    </div>
  )
}

// ── Lock icon ─────────────────────────────────────────────────────────────────

function LockIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}
