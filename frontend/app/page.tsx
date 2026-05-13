/**
 * Homepage — Sprint 0 placeholder.
 *
 * This is intentionally minimal. The real homepage is built in Sprint 3.
 * Sprint 0's job: confirm the layout renders, contexts work, and toggles function.
 *
 * This page demonstrates:
 *   - Fan/Pro toggle integration
 *   - ProLock component usage
 *   - Design tokens in action
 *   - Dark/light mode rendering
 */

import type { Metadata } from 'next'
import { SprintZeroDemo } from '@/components/pages/SprintZeroDemo'

export const metadata: Metadata = {
  title: 'Pressing Room — Ligue 1 Football Analytics',
}

export default function HomePage() {
  return (
    <div className="page-container py-12">
      <SprintZeroDemo />
    </div>
  )
}
