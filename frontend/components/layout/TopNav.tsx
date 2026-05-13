'use client'

/**
 * TopNav — persistent top navigation bar.
 *
 * Sprint 0 state: Logo + nav links (hrefs only, no active state) + both toggles.
 * Sprint 1+: Add active state, mobile hamburger, league selector.
 *
 * Design rules:
 *   - Sticky at top (position: sticky, z-index: 50)
 *   - Full-width, max-width container inside
 *   - Backdrop blur for depth on scroll
 *   - Fan/Pro toggle always visible, right of nav links
 *   - Theme toggle rightmost
 */

import Link from 'next/link'
import { FanProToggle } from '@/components/ui/FanProToggle'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

const NAV_LINKS = [
  { href: '/fixtures',  label: 'Fixtures' },
  { href: '/results',   label: 'Results' },
  { href: '/standings', label: 'Standings' },
  { href: '/scorers',   label: 'Scorers' },
]

export function TopNav() {
  return (
    <header
      className={`
        sticky top-0 z-50
        border-b border-[var(--border-default)]
        bg-[var(--bg-surface)] bg-opacity-90
        backdrop-blur-md
        transition-colors duration-300
      `}
    >
      <div className="page-container">
        <nav
          className="flex items-center justify-between h-14 gap-6"
          aria-label="Main navigation"
        >
          {/* ── Brand ─────────────────────────────────────────────────────── */}
          <Link
            href="/"
            className="flex items-center gap-2 shrink-0"
            aria-label="Pressing Room — home"
          >
            {/* Wordmark */}
            <span
              className="font-display text-lg font-normal tracking-tight text-[var(--text-primary)]"
              style={{ fontFamily: '"Instrument Serif", Georgia, serif' }}
            >
              Pressing Room
            </span>
            {/* Ligue 1 badge — small, muted */}
            <span
              className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                         bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border-default)]"
            >
              Ligue 1
            </span>
          </Link>

          {/* ── Nav links ─────────────────────────────────────────────────── */}
          <div
            className="hidden md:flex items-center gap-1"
            role="list"
          >
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                role="listitem"
                className={`
                  px-3 py-1.5 rounded-md
                  text-sm font-medium
                  text-[var(--text-secondary)]
                  hover:text-[var(--text-primary)]
                  hover:bg-[var(--bg-hover)]
                  transition-colors duration-150
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]
                `}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* ── Right controls ────────────────────────────────────────────── */}
          <div className="flex items-center gap-2 shrink-0">
            <FanProToggle />
            <div className="w-px h-5 bg-[var(--border-default)]" aria-hidden="true" />
            <ThemeToggle />
          </div>
        </nav>
      </div>
    </header>
  )
}
