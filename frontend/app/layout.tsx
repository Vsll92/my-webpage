/**
 * Root Layout — wraps every page in the application.
 *
 * Responsibilities:
 *   - Global CSS import
 *   - Font loading via Google Fonts (imported in globals.css)
 *   - ThemeProvider (dark/light mode)
 *   - ViewModeProvider (Fan/Pro toggle)
 *   - TopNav + Footer on every page
 *   - Anti-flash inline script (prevents theme flicker on load)
 *   - Base SEO metadata
 *
 * The inline <script> runs synchronously before React hydrates.
 * It reads localStorage and sets data-theme on <html>, preventing
 * the flash where the page briefly shows the wrong theme.
 */

import type { Metadata } from 'next'
import './globals.css'

import { ThemeProvider, THEME_INIT_SCRIPT } from '@/contexts/ThemeContext'
import { ViewModeProvider } from '@/contexts/ViewModeContext'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { TopNav } from '@/components/layout/TopNav'
import { Footer } from '@/components/layout/Footer'

// ── Base Metadata ─────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: {
    default: 'Pressing Room — Ligue 1 Football Analytics',
    template: '%s — Pressing Room',
  },
  description:
    'France Ligue 1 football analytics. Shot maps, xG, pressing intensity, and tactical analysis. Every match. Every pattern. Explained.',
  keywords: ['Ligue 1', 'football analytics', 'xG', 'tactical analysis', 'France football'],
  authors: [{ name: 'Pressing Room' }],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'Pressing Room',
    title: 'Pressing Room — Ligue 1 Football Analytics',
    description: 'France Ligue 1 football analytics. Shot maps, xG, pressing intensity, and tactical analysis.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pressing Room — Ligue 1 Football Analytics',
    description: 'France Ligue 1 football analytics. Every match. Every pattern. Explained.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

// ── Root Layout ───────────────────────────────────────────────────────────────

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    /*
     * suppressHydrationWarning on <html> is required because:
     *   - The inline script sets data-theme before React hydrates
     *   - React detects a mismatch between server-rendered HTML (no data-theme)
     *     and client-rendered HTML (with data-theme set by the script)
     *   - suppressHydrationWarning tells React this mismatch is intentional
     *
     * This is the standard pattern for preventing theme flash in Next.js.
     * See: https://nextjs.org/docs/app/building-your-application/styling/css-variables
     */
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
         * Anti-flash script: runs synchronously before page renders.
         * Sets data-theme on <html> from localStorage before React paints.
         * dangerouslySetInnerHTML is intentional and safe here — this is
         * a trusted, static string we control (not user input).
         */}
        <script
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
      </head>
      <body>
        <ThemeProvider>
          <ViewModeProvider>
            <TooltipProvider>
              {/* Skip-to-content link for accessibility */}
              <a
                href="#main-content"
                className={`
                  sr-only focus:not-sr-only
                  fixed top-4 left-4 z-[100]
                  px-4 py-2 rounded-md
                  bg-[var(--accent-primary)] text-white text-sm font-medium
                `}
              >
                Skip to content
              </a>

              {/* Navigation */}
              <TopNav />

              {/* Main content — pages render here */}
              <main id="main-content" className="min-h-screen">
                {children}
              </main>

              {/* Footer */}
              <Footer />
            </TooltipProvider>
          </ViewModeProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
