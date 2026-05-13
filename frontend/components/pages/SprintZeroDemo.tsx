'use client'

/**
 * SprintZeroDemo — Sprint 0 acceptance validation page.
 *
 * This component exists ONLY to verify that all Sprint 0 foundations work:
 *   ✓ Design tokens render correctly (colors, typography, spacing)
 *   ✓ Dark/light mode switches all tokens
 *   ✓ Fan/Pro toggle persists across refresh
 *   ✓ ProLock blur overlay works
 *   ✓ Fonts load (Instrument Serif, DM Sans, DM Mono)
 *   ✓ No hydration errors in console
 *
 * Remove this component in Sprint 1 when real pages replace it.
 */

import { useViewMode } from '@/contexts/ViewModeContext'
import { useTheme } from '@/contexts/ThemeContext'
import { ProLock } from '@/components/ui/ProLock'

export function SprintZeroDemo() {
  const { mode, isProMode } = useViewMode()
  const { theme } = useTheme()

  return (
    <div className="space-y-12">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium
                       bg-[var(--accent-primary)] text-white"
          >
            Sprint 0
          </span>
          <span className="text-sm text-[var(--text-muted)]">Foundation check</span>
        </div>
        <h1
          className="text-4xl text-[var(--text-primary)]"
          style={{ fontFamily: '"Instrument Serif", Georgia, serif' }}
        >
          Pressing Room
        </h1>
        <p className="text-[var(--text-secondary)] text-base max-w-lg">
          Sprint 0 foundation. All design tokens, contexts, and toggles active.
          Real pages replace this in Sprint 3.
        </p>
      </div>

      {/* ── State display ──────────────────────────────────────────────────── */}
      <div
        className="card flex items-center gap-8 flex-wrap"
        style={{ fontFamily: '"DM Mono", monospace' }}
      >
        <div>
          <div className="text-xs text-[var(--text-muted)] mb-1">View mode</div>
          <div className="text-[var(--accent-primary)] font-medium">
            {mode}
          </div>
        </div>
        <div className="w-px h-8 bg-[var(--border-default)]" />
        <div>
          <div className="text-xs text-[var(--text-muted)] mb-1">Theme</div>
          <div className="text-[var(--accent-primary)] font-medium">
            {theme}
          </div>
        </div>
        <div className="w-px h-8 bg-[var(--border-default)]" />
        <div>
          <div className="text-xs text-[var(--text-muted)] mb-1">Pro access</div>
          <div className={isProMode ? 'text-[var(--accent-secondary)]' : 'text-[var(--text-muted)]'}>
            {isProMode ? '✓ unlocked' : '✗ locked'}
          </div>
        </div>
      </div>

      {/* ── Design token swatches ─────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="type-heading-sm text-[var(--text-primary)]">Design Tokens</h2>

        <div className="space-y-2">
          <p className="text-xs type-label text-[var(--text-muted)]">Backgrounds</p>
          <div className="flex gap-2 flex-wrap">
            {[
              { name: 'base',    var: 'var(--bg-base)',    label: '--bg-base' },
              { name: 'surface', var: 'var(--bg-surface)', label: '--bg-surface' },
              { name: 'hover',   var: 'var(--bg-hover)',   label: '--bg-hover' },
              { name: 'subtle',  var: 'var(--bg-subtle)',  label: '--bg-subtle' },
            ].map((s) => (
              <div key={s.name} className="flex flex-col items-center gap-1">
                <div
                  className="w-16 h-10 rounded-md border border-[var(--border-default)]"
                  style={{ backgroundColor: s.var }}
                />
                <span className="text-[10px] font-mono text-[var(--text-muted)]">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs type-label text-[var(--text-muted)]">Accents</p>
          <div className="flex gap-2 flex-wrap">
            {[
              { var: 'var(--accent-primary)',   label: 'primary' },
              { var: 'var(--accent-secondary)', label: 'secondary' },
              { var: 'var(--accent-warning)',   label: 'warning' },
              { var: 'var(--accent-amber)',      label: 'amber' },
            ].map((s) => (
              <div key={s.label} className="flex flex-col items-center gap-1">
                <div
                  className="w-16 h-10 rounded-md"
                  style={{ backgroundColor: s.var }}
                />
                <span className="text-[10px] font-mono text-[var(--text-muted)]">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs type-label text-[var(--text-muted)]">Shot outcomes (fixed forever)</p>
          <div className="flex gap-2 flex-wrap">
            {[
              { var: 'var(--shot-goal)',    label: 'goal' },
              { var: 'var(--shot-saved)',   label: 'saved' },
              { var: 'var(--shot-blocked)', label: 'blocked' },
            ].map((s) => (
              <div key={s.label} className="flex flex-col items-center gap-1">
                <div
                  className="w-16 h-10 rounded-md border border-[var(--border-default)]"
                  style={{ backgroundColor: s.var }}
                />
                <span className="text-[10px] font-mono text-[var(--text-muted)]">{s.label}</span>
              </div>
            ))}
            <div className="flex flex-col items-center gap-1">
              <div
                className="w-16 h-10 rounded-md border border-[var(--border-default)]"
                style={{ backgroundColor: 'var(--pitch-surface)' }}
              />
              <span className="text-[10px] font-mono text-[var(--text-muted)]">miss (on pitch)</span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs type-label text-[var(--text-muted)]">Pitch surface</p>
          <div
            className="w-48 h-16 rounded-md"
            style={{
              backgroundColor: 'var(--pitch-surface)',
              border: '2px solid var(--pitch-lines)',
            }}
          >
            <div
              className="w-full h-full flex items-center justify-center text-xs"
              style={{ color: 'var(--pitch-lines)' }}
            >
              --pitch-surface
            </div>
          </div>
        </div>
      </section>

      {/* ── Typography ────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="type-heading-sm text-[var(--text-primary)]">Typography</h2>
        <div className="card space-y-4">
          <div
            className="text-4xl text-[var(--text-primary)]"
            style={{ fontFamily: '"Instrument Serif", Georgia, serif' }}
          >
            Instrument Serif — Display
          </div>
          <div className="text-lg font-semibold text-[var(--text-primary)]"
            style={{ fontFamily: '"DM Sans", sans-serif' }}>
            DM Sans Semibold — Headings
          </div>
          <div className="text-base text-[var(--text-secondary)]"
            style={{ fontFamily: '"DM Sans", sans-serif' }}>
            DM Sans Regular — Body text. France Ligue 1 football analytics.
          </div>
          <div
            className="text-sm text-[var(--text-muted)]"
            style={{ fontFamily: '"DM Mono", monospace' }}
          >
            DM Mono — 0.847 xG | 14 shots | PPDA: 8.4 | 62.4%
          </div>
        </div>
      </section>

      {/* ── Fan / Pro toggle demo ─────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="type-heading-sm text-[var(--text-primary)]">Fan / Pro Toggle</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          The toggle in the top-right navigation switches the view mode.
          In Fan mode, Pro content is blurred. In Pro mode, full data is visible.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Public content — always visible */}
          <div className="card">
            <div className="text-xs type-label text-[var(--text-muted)] mb-3">
              Public — always visible
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-[var(--text-secondary)]">Goals</span>
                <span
                  className="text-lg font-medium text-[var(--text-primary)]"
                  style={{ fontFamily: '"DM Mono", monospace' }}
                >
                  14
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-[var(--text-secondary)]">Shots / 90</span>
                <span
                  className="text-lg font-medium text-[var(--text-primary)]"
                  style={{ fontFamily: '"DM Mono", monospace' }}
                >
                  4.2
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-[var(--text-secondary)]">Form</span>
                <div className="flex gap-1">
                  {['W','W','D','W','L'].map((r, i) => (
                    <div
                      key={i}
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                      style={{
                        backgroundColor:
                          r === 'W' ? 'var(--accent-secondary)' :
                          r === 'L' ? 'var(--accent-warning)' :
                          'var(--text-muted)',
                      }}
                    >
                      {r}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Pro content — blurred in Fan mode */}
          <ProLock ctaText="Unlock Pro analytics →" minHeight={140}>
            <div className="card">
              <div className="text-xs type-label text-[var(--accent-primary)] mb-3">
                Pro — analytical layer
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[var(--text-secondary)]">xG For</span>
                  <span
                    className="text-lg font-medium text-[var(--accent-secondary)]"
                    style={{ fontFamily: '"DM Mono", monospace' }}
                  >
                    11.8
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[var(--text-secondary)]">npxG</span>
                  <span
                    className="text-lg font-medium text-[var(--text-primary)]"
                    style={{ fontFamily: '"DM Mono", monospace' }}
                  >
                    11.8
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[var(--text-secondary)]">PPDA</span>
                  <span
                    className="text-lg font-medium text-[var(--text-primary)]"
                    style={{ fontFamily: '"DM Mono", monospace' }}
                  >
                    8.4
                  </span>
                </div>
              </div>
            </div>
          </ProLock>
        </div>

        {/* Toggle state confirmation */}
        <div
          className="rounded-md px-4 py-3 text-sm border"
          style={{
            backgroundColor: isProMode ? 'var(--pro-bg)' : 'var(--bg-subtle)',
            borderColor: isProMode ? 'var(--pro-border)' : 'var(--border-default)',
            color: isProMode ? 'var(--pro-text)' : 'var(--text-secondary)',
          }}
        >
          {isProMode
            ? '✓ Pro mode active — all analytical data visible'
            : 'Fan mode active — switch to Pro to unlock xG, PPDA, and tactical data'
          }
        </div>
      </section>

      {/* ── Sprint 0 checklist ────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="type-heading-sm text-[var(--text-primary)]">Sprint 0 Checklist</h2>
        <div className="card space-y-3">
          {[
            'Frontend runs (Next.js dev server)',
            'Backend runs (FastAPI /api/health returns 200)',
            'Database migration succeeded (5 tables exist)',
            'One CSV ingested (ingest_one_match.py succeeds)',
            'Dark mode works and persists across refresh',
            'Light mode works and persists across refresh',
            'Fan/Pro toggle works and persists across refresh',
            'Fonts loaded: Instrument Serif, DM Sans, DM Mono',
            'No console errors or hydration warnings',
            'CSS variables switch correctly between themes',
            'ProLock blurs content in Fan mode',
            'ProLock shows content in Pro mode',
          ].map((item) => (
            <div key={item} className="flex items-start gap-3">
              <div
                className="mt-0.5 w-4 h-4 rounded border border-[var(--border-default)] flex-shrink-0"
                role="checkbox"
                aria-checked="false"
                aria-label={item}
              />
              <span className="text-sm text-[var(--text-secondary)]">{item}</span>
            </div>
          ))}
        </div>
      </section>

    </div>
  )
}
