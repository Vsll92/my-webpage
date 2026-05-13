'use client'

/**
 * TeamBadge — displays a team's crest image with an initials fallback.
 *
 * Image path: /crests/{teamId}.png (or .svg)
 * Fallback:   First two letters of team name, on a hashed background color.
 *
 * The fallback is deterministic — same team always gets the same color.
 * Colors are desaturated enough to not clash with the UI, while still
 * being visually distinct between teams.
 *
 * Sizes: xs=20px sm=32px md=48px lg=64px
 */

import { useState } from 'react'
import { clsx } from 'clsx'

const SIZES = {
  xs: { px: 20,  text: 'text-[8px]',  ring: 'ring-1' },
  sm: { px: 32,  text: 'text-[10px]', ring: 'ring-1' },
  md: { px: 48,  text: 'text-sm',     ring: 'ring-[1.5px]' },
  lg: { px: 64,  text: 'text-lg',     ring: 'ring-2' },
} as const

// Deterministic muted color from team name string
function teamColor(teamName: string): string {
  const colors = [
    '#4A5568', '#2D6A8A', '#276749', '#744210',
    '#553C9A', '#97266D', '#2C5282', '#C53030',
    '#285E61', '#744210', '#4A5568', '#276749',
    '#553C9A', '#2D6A8A', '#97266D', '#2C5282',
    '#285E61', '#C53030',
  ]
  let hash = 0
  for (let i = 0; i < teamName.length; i++) {
    hash = (hash * 31 + teamName.charCodeAt(i)) >>> 0
  }
  return colors[hash % colors.length]
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

interface TeamBadgeProps {
  teamId: string
  teamName: string
  size?: keyof typeof SIZES
  className?: string
}

export function TeamBadge({
  teamId,
  teamName,
  size = 'md',
  className = '',
}: TeamBadgeProps) {
  const [imgFailed, setImgFailed] = useState(false)
  const s = SIZES[size]
  const px = s.px

  const sharedClasses = clsx(
    'rounded-full flex-shrink-0 overflow-hidden',
    'ring-[var(--border-default)]',
    s.ring,
    className,
  )

  if (!imgFailed) {
    return (
      <img
        src={`/crests/${teamId}.png`}
        alt={`${teamName} crest`}
        width={px}
        height={px}
        className={clsx(sharedClasses, 'object-contain bg-[var(--bg-surface)]')}
        onError={() => setImgFailed(true)}
        style={{ width: px, height: px }}
      />
    )
  }

  // Fallback: initials circle
  return (
    <div
      className={clsx(sharedClasses, 'flex items-center justify-center flex-shrink-0')}
      style={{
        width: px,
        height: px,
        backgroundColor: teamColor(teamName),
      }}
      aria-label={teamName}
      title={teamName}
    >
      <span
        className={clsx(s.text, 'font-semibold text-white select-none leading-none')}
      >
        {initials(teamName)}
      </span>
    </div>
  )
}
