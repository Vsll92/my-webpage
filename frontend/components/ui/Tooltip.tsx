'use client'

/**
 * Tooltip — accessible hover tooltip using Radix UI.
 *
 * Design rules:
 *   - Background is ALWAYS dark (#1A1E2A), regardless of theme.
 *     High contrast tooltip is more readable on both light and dark pages.
 *   - Max width: 220px
 *   - 12px padding
 *   - 6px border radius
 *   - Content can be a string or React node
 *   - Delay: 200ms (feels responsive, not instant)
 *
 * The TooltipProvider must be in the component tree. It's added in layout.tsx.
 */

import {
  Provider,
  Root,
  Trigger,
  Content,
  Portal,
  Arrow,
} from '@radix-ui/react-tooltip'
import { type ReactNode } from 'react'

// ── Provider (place once in layout.tsx) ──────────────────────────────────────
export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <Provider delayDuration={200} skipDelayDuration={100}>
      {children}
    </Provider>
  )
}

// ── Individual Tooltip ────────────────────────────────────────────────────────
interface TooltipProps {
  content: ReactNode      // The tooltip body — string or JSX
  children: ReactNode     // The trigger element (must forward ref or be a button/span)
  side?: 'top' | 'bottom' | 'left' | 'right'
  maxWidth?: number
  disabled?: boolean
}

export function Tooltip({
  content,
  children,
  side = 'top',
  maxWidth = 220,
  disabled = false,
}: TooltipProps) {
  if (disabled) return <>{children}</>

  return (
    <Root>
      <Trigger asChild>
        {/* Wrap in span to ensure the trigger accepts a ref */}
        <span className="inline-flex cursor-help">{children}</span>
      </Trigger>
      <Portal>
        <Content
          side={side}
          sideOffset={6}
          className="z-50 rounded-md px-3 py-2 text-sm leading-snug shadow-lg
                     animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out
                     data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
          style={{
            // Always dark — high contrast on both light and dark backgrounds
            backgroundColor: '#1A1E2A',
            color: '#F0F0EC',
            border: '1px solid #2D3348',
            maxWidth,
          }}
        >
          {content}
          <Arrow
            className="fill-[#1A1E2A]"
            width={8}
            height={4}
          />
        </Content>
      </Portal>
    </Root>
  )
}

// ── Metric tooltip content (pre-styled) ──────────────────────────────────────
// Use MetricTooltip for consistent metric definition popups.

interface MetricTooltipProps {
  name: string
  definition: string
  methodology?: string    // optional: how it's calculated
}

export function MetricTooltip({ name, definition, methodology }: MetricTooltipProps) {
  return (
    <div className="space-y-1">
      <div className="font-medium text-[#F0F0EC] text-xs">{name}</div>
      <div className="text-[#8B8FA8] text-xs leading-relaxed">{definition}</div>
      {methodology && (
        <div className="text-[#4A4E65] text-[11px] leading-relaxed pt-0.5 border-t border-[#2D3348]">
          {methodology}
        </div>
      )}
    </div>
  )
}
