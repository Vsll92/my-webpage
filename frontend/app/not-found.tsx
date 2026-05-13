import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="page-container py-24 text-center">
      <div
        className="text-8xl text-[var(--text-muted)] mb-6 select-none"
        style={{ fontFamily: '"Instrument Serif", Georgia, serif' }}
      >
        404
      </div>
      <h1 className="type-heading-lg text-[var(--text-primary)] mb-3">
        Page not found
      </h1>
      <p className="text-[var(--text-secondary)] text-sm mb-8 max-w-sm mx-auto">
        The page you're looking for doesn't exist, or the match or team you're
        trying to reach hasn't been ingested yet.
      </p>
      <div className="flex items-center justify-center gap-4 flex-wrap">
        <Link
          href="/"
          className="px-4 py-2 rounded-md bg-[var(--accent-primary)] text-white text-sm font-medium
                     hover:opacity-90 transition-opacity"
        >
          Go to homepage
        </Link>
        <Link
          href="/standings"
          className="px-4 py-2 rounded-md border border-[var(--border-default)]
                     text-[var(--text-secondary)] text-sm
                     hover:bg-[var(--bg-hover)] transition-colors"
        >
          View standings
        </Link>
      </div>
    </div>
  )
}
