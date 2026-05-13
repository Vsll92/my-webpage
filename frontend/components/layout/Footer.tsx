/**
 * Footer — minimal, links to methodology and about pages.
 *
 * Design: calm, muted. Does not compete with content.
 * The methodology link is prominent because professional trust
 * depends on users being able to verify how metrics are calculated.
 */

import Link from 'next/link'

const FOOTER_LINKS = [
  { href: '/methodology', label: 'Methodology' },
  { href: '/pro',         label: 'Pro' },
]

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer
      className={`
        mt-24
        border-t border-[var(--border-default)]
        bg-[var(--bg-surface)]
      `}
    >
      <div className="page-container">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-8">
          {/* Brand */}
          <span
            className="text-sm text-[var(--text-muted)]"
            style={{ fontFamily: '"Instrument Serif", Georgia, serif' }}
          >
            Pressing Room &copy; {year}
          </span>

          {/* Links */}
          <nav aria-label="Footer navigation">
            <ul className="flex items-center gap-6">
              {FOOTER_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`
                      text-sm text-[var(--text-muted)]
                      hover:text-[var(--text-secondary)]
                      transition-colors duration-150
                    `}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Tagline */}
          <span className="text-xs text-[var(--text-muted)] font-mono">
            Every match. Every pattern. Explained.
          </span>
        </div>
      </div>
    </footer>
  )
}
