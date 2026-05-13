import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Pro',
  description: 'Pressing Room Pro — full xG analytics, tactical depth, and advanced analysis for Ligue 1.',
}

export default function ProPage() {
  return (
    <div className="page-container py-12 max-w-3xl mx-auto">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="mb-12 space-y-4">
        <h1
          className="text-4xl text-[var(--text-primary)]"
          style={{ fontFamily: '"Instrument Serif", Georgia, serif' }}
        >
          Pressing Room
        </h1>
        <p className="text-xl text-[var(--text-secondary)] leading-relaxed">
          Football intelligence for France Ligue 1. Built for analysts, scouts,
          coaches, and fans who want to understand what they're watching.
        </p>
        <p className="text-[var(--text-secondary)] leading-relaxed">
          Every match is processed into event-level data — every pass, every shot,
          every defensive action — and turned into clear, honest analytical output.
          Shot maps, xG timelines, pressing intensity, and tactical profiles,
          all in one place.
        </p>
      </div>

      {/* ── Free vs Pro table ─────────────────────────────────────────────── */}
      <section className="mb-12">
        <h2 className="type-heading-md text-[var(--text-primary)] mb-6">
          What's included
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Free */}
          <div className="card">
            <div className="text-xs type-label text-[var(--text-muted)] mb-4">Free</div>
            <ul className="space-y-2">
              {[
                'All fixtures and results',
                'Full league standings with form',
                'Top scorers (goals, assists, shots)',
                'Team pages — form, record, recent matches',
                'Match center — scoreline, match facts',
                'Shot map (outcome colors)',
                'Starting lineups and substitutions',
                'Methodology documentation',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                  <CheckIcon color="var(--text-muted)" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Pro */}
          <div className="card card-pro">
            <div className="text-xs type-label text-[var(--pro-text)] mb-4">Pro</div>
            <ul className="space-y-2">
              {[
                'xG (Expected Goals) on every shot',
                'xG timeline for every match',
                'xG columns in league table',
                'xG-sized shot dots (quality, not just outcome)',
                'npxG, xG/shot, goals above xG in top scorers',
                'PPDA pressing intensity on team pages',
                'Defensive action height metric',
                'xG delta (over/underperformance badge)',
                'Tactical tab in match center',
                'Pro-density analytical views',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                  <CheckIcon color="var(--accent-primary)" />
                  {item}
                </li>
              ))}
            </ul>

            {/* Coming soon */}
            <div className="mt-4 pt-4 border-t border-[var(--border-default)]">
              <p className="text-[11px] type-label text-[var(--text-muted)] mb-2">Coming soon</p>
              {[
                'Passing networks',
                'Pressing maps',
                'Full team analysis hub',
                'Pre-match and post-match reports',
                'Advanced team comparisons',
              ].map((item) => (
                <p key={item} className="text-xs text-[var(--text-muted)] mb-1">+ {item}</p>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing / waitlist ────────────────────────────────────────────── */}
      <section className="mb-12">
        <div className="card bg-[var(--pro-bg)] border-[var(--pro-border)]">
          <h3 className="type-heading-sm text-[var(--text-primary)] mb-2">
            Pro is currently in open preview
          </h3>
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            The Fan/Pro toggle is free during the preview period. Switch to Pro mode
            in the top navigation to access all analytical features at no cost.
          </p>
          <p className="text-sm text-[var(--text-secondary)]">
            A subscription will be introduced at <strong>€12.99/month</strong> once
            the product reaches V1 stability. Early users who join now will receive
            a discount.
          </p>
        </div>
      </section>

      {/* ── Contact ───────────────────────────────────────────────────────── */}
      <section>
        <h2 className="type-heading-md text-[var(--text-primary)] mb-4">Contact</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-2">
          Questions about data, methodology, or partnership enquiries:
        </p>
        <p className="text-sm text-[var(--accent-primary)]">
          hello@pressingroom.com
        </p>
        <p className="text-sm text-[var(--text-muted)] mt-4">
          <Link href="/methodology" className="text-[var(--accent-primary)] hover:underline">
            Read the full methodology →
          </Link>
        </p>
      </section>

    </div>
  )
}

function CheckIcon({ color }: { color: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="flex-shrink-0 mt-0.5"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
