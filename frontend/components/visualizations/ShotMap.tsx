'use client'

/**
 * ShotMap — pitch SVG with shot dots, legend, and caption.
 *
 * Coordinate model (bidirectional, after pipeline normalization):
 *   - Home shots:  x > 60 → appear on the right half (near x=100, the away goal)
 *   - Away shots:  x < 40 → appear on the left half  (near x=0,   the home goal)
 *
 * Fan mode:  all dots are equal size (6px radius)
 * Pro mode:  dots are sized by xG (4 + xg * 16, range 4–20px)
 *
 * This is the flagship visual. It must be pixel-perfect.
 */

import { useState } from 'react'
import { useViewMode } from '@/contexts/ViewModeContext'
import { PITCH, toSVGCoords, shotDotRadius, SHOT_OUTCOME_COLORS, type ShotOutcome } from '@/lib/constants'
import { clsx } from 'clsx'

export interface ShotData {
  id: number
  player_name: string
  team_id: string
  is_home: boolean
  minute: number
  period: number
  x: number
  y: number
  xg?: number | null
  outcome: ShotOutcome
  is_header: boolean
  is_penalty: boolean
  zone?: string | null
}

interface ShotMapProps {
  shots: ShotData[]
  homeTeamId: string
  awayTeamId: string
  width?: number
}

interface TooltipState {
  shot: ShotData
  clientX: number
  clientY: number
}

export default function ShotMap({ shots, homeTeamId, awayTeamId, width = 840 }: ShotMapProps) {
  const { isProMode } = useViewMode()
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  // Scale height to maintain 105:68 pitch ratio
  const height = Math.round((width / PITCH.WIDTH) * PITCH.HEIGHT)

  return (
    <div className="space-y-3">

      {/* ── Pitch SVG ────────────────────────────────────────────────────────── */}
      <div className="relative w-full overflow-hidden rounded-lg">
        <svg
          viewBox={`0 0 ${PITCH.WIDTH} ${PITCH.HEIGHT}`}
          width="100%"
          style={{ display: 'block', maxWidth: width, margin: '0 auto' }}
          aria-label={`Shot map: ${shots.length} shots displayed`}
          role="img"
        >
          {/* ── Pitch surface ─────────────────────────────────────────────── */}
          <rect
            width={PITCH.WIDTH}
            height={PITCH.HEIGHT}
            fill="var(--pitch-surface)"
            rx={4}
          />

          {/* ── Pitch lines ───────────────────────────────────────────────── */}
          {/* Outer boundary */}
          <rect
            x={0} y={0}
            width={PITCH.WIDTH} height={PITCH.HEIGHT}
            fill="none"
            stroke="var(--pitch-lines)"
            strokeWidth={2.5}
          />
          {/* Centre line */}
          <line
            x1={PITCH.WIDTH / 2} y1={0}
            x2={PITCH.WIDTH / 2} y2={PITCH.HEIGHT}
            stroke="var(--pitch-lines)" strokeWidth={1.5}
          />
          {/* Centre circle */}
          <circle
            cx={PITCH.WIDTH / 2} cy={PITCH.HEIGHT / 2}
            r={PITCH.CENTRE_CIRCLE_R}
            fill="none" stroke="var(--pitch-lines)" strokeWidth={1.5}
          />
          <circle
            cx={PITCH.WIDTH / 2} cy={PITCH.HEIGHT / 2}
            r={4} fill="var(--pitch-lines)"
          />

          {/* ── Left penalty area (home defends, away attacks from here) ───── */}
          <rect
            x={0}
            y={(PITCH.HEIGHT - PITCH.BOX_WIDTH) / 2}
            width={PITCH.BOX_LENGTH}
            height={PITCH.BOX_WIDTH}
            fill="none" stroke="var(--pitch-lines)" strokeWidth={1.5}
          />
          <rect
            x={0}
            y={(PITCH.HEIGHT - PITCH.SIX_YARD_WIDTH) / 2}
            width={PITCH.SIX_YARD_LENGTH}
            height={PITCH.SIX_YARD_WIDTH}
            fill="none" stroke="var(--pitch-lines)" strokeWidth={1}
          />

          {/* ── Right penalty area (away defends, home attacks here) ─────── */}
          <rect
            x={PITCH.WIDTH - PITCH.BOX_LENGTH}
            y={(PITCH.HEIGHT - PITCH.BOX_WIDTH) / 2}
            width={PITCH.BOX_LENGTH}
            height={PITCH.BOX_WIDTH}
            fill="none" stroke="var(--pitch-lines)" strokeWidth={1.5}
          />
          <rect
            x={PITCH.WIDTH - PITCH.SIX_YARD_LENGTH}
            y={(PITCH.HEIGHT - PITCH.SIX_YARD_WIDTH) / 2}
            width={PITCH.SIX_YARD_LENGTH}
            height={PITCH.SIX_YARD_WIDTH}
            fill="none" stroke="var(--pitch-lines)" strokeWidth={1}
          />
          {/* Right penalty spot */}
          <circle
            cx={PITCH.WIDTH - PITCH.PENALTY_SPOT_X}
            cy={PITCH.HEIGHT / 2}
            r={4}
            fill="var(--pitch-lines)"
          />

          {/* ── Shot dots ────────────────────────────────────────────────────── */}
          {shots.map((shot) => {
            const { cx, cy } = toSVGCoords(shot.x, shot.y)
            const r = shotDotRadius(shot.xg ?? 0, isProMode)
            const color = SHOT_OUTCOME_COLORS[shot.outcome]
            const strokeColor = shot.outcome === 'miss'
              ? 'rgba(255,255,255,0.5)'
              : 'none'

            return (
              <circle
                key={shot.id}
                cx={cx}
                cy={cy}
                r={r}
                fill={color}
                stroke={strokeColor}
                strokeWidth={shot.outcome === 'miss' ? 1 : 0}
                className="cursor-pointer transition-opacity hover:opacity-80"
                onMouseEnter={(e) => setTooltip({ shot, clientX: e.clientX, clientY: e.clientY })}
                onMouseLeave={() => setTooltip(null)}
              />
            )
          })}
        </svg>

        {/* ── Tooltip ─────────────────────────────────────────────────────────── */}
        {tooltip && (
          <div
            className="fixed z-50 pointer-events-none rounded-lg px-3 py-2 shadow-lg text-sm"
            style={{
              left: tooltip.clientX + 12,
              top:  tooltip.clientY - 48,
              maxWidth: 220,
              backgroundColor: '#1A1E2A',
              color: '#F0F0EC',
              border: '1px solid #2D3348',
            }}
          >
            <div className="font-medium">{tooltip.shot.player_name}</div>
            <div className="text-[#8B8FA8] text-xs mt-0.5">
              {tooltip.shot.minute}&apos; · {tooltip.shot.outcome}
              {tooltip.shot.is_header && ' · Header'}
              {tooltip.shot.is_penalty && ' · Penalty'}
            </div>
            {isProMode && tooltip.shot.xg != null && (
              <div
                className="text-xs mt-0.5"
                style={{
                  color: '#36B37E',
                  fontFamily: '"DM Mono", monospace',
                }}
              >
                xG: {tooltip.shot.xg.toFixed(2)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Legend ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 flex-wrap">
        {(
          [
            { outcome: 'goal'    as ShotOutcome, label: 'Goal' },
            { outcome: 'saved'   as ShotOutcome, label: 'Saved' },
            { outcome: 'miss'    as ShotOutcome, label: 'Off target' },
            { outcome: 'blocked' as ShotOutcome, label: 'Blocked' },
          ] as const
        ).map(({ outcome, label }) => (
          <div key={outcome} className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0 border"
              style={{
                backgroundColor: SHOT_OUTCOME_COLORS[outcome],
                borderColor: outcome === 'miss' ? 'rgba(255,255,255,0.3)' : 'transparent',
              }}
            />
            <span className="text-xs text-[var(--text-muted)]">{label}</span>
          </div>
        ))}
        {isProMode && (
          <span className="text-xs text-[var(--text-muted)] italic ml-2">
            Dot size = xG (shot quality)
          </span>
        )}
      </div>

      {/* ── Caption ──────────────────────────────────────────────────────────── */}
      <p className="text-xs text-[var(--text-muted)] leading-relaxed">
        Each dot is a shot attempt.
        {isProMode && ' Size shows expected goal quality (xG) — bigger = better chance.'}
        {' '}Attack direction is left → right for the home team.
      </p>
    </div>
  )
}
