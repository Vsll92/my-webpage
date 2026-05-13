/**
 * API client — base fetcher and URL builder.
 *
 * Environment variable: NEXT_PUBLIC_API_URL
 *
 * Set this in frontend/.env.local:
 *   NEXT_PUBLIC_API_URL=http://localhost:8000
 *
 * The variable MUST be prefixed with NEXT_PUBLIC_ to be available
 * in the browser. Variables without that prefix are server-only.
 *
 * IMPORTANT: If you change this value, you must:
 *   1. Stop the dev server (Ctrl+C)
 *   2. Delete the .next/ cache folder
 *   3. Run npm run dev again
 */

export const API_URL: string =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

/**
 * Base SWR fetcher.
 *
 * - Receives the SWR cache key (the path, e.g. "/api/standings")
 * - Prepends API_URL to build the full backend URL
 * - Throws APIError on non-2xx responses so SWR populates its `error` state
 * - Throws natively for network failures (CORS, offline, DNS) — SWR also
 *   catches those and populates `error`
 *
 * Usage:
 *   const { data, error, isLoading } = useSWR('/api/standings', fetcher)
 */
export async function fetcher<T = unknown>(path: string): Promise<T> {
  const url = `${API_URL}${path}`

  let res: Response
  try {
    res = await fetch(url, {
      headers: { Accept: 'application/json' },
      // Explicitly omit credentials — the backend's CORS config
      // has allow_credentials=False, so sending cookies would break
      // the preflight in some browsers.
      credentials: 'omit',
    })
  } catch (networkError) {
    // Re-throw as a friendlier error so the UI can distinguish
    // "API returned 404" from "could not reach the server".
    throw new NetworkError(url, networkError as Error)
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new APIError(res.status, path, body)
  }

  return res.json() as Promise<T>
}

// ── Error types ───────────────────────────────────────────────────────────────

/**
 * Thrown when the server returns a non-2xx status code.
 * SWR will put this in the `error` state.
 */
export class APIError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    public readonly body: string,
  ) {
    super(`API ${status}: ${path}`)
    this.name = 'APIError'
  }

  get isNotFound(): boolean { return this.status === 404 }
  get isServerError(): boolean { return this.status >= 500 }
}

/**
 * Thrown when fetch() itself fails — CORS block, server offline, no DNS.
 * If you see this in the UI, check:
 *   1. Is the FastAPI backend running? (uvicorn app.main:app --reload)
 *   2. Is ALLOWED_ORIGINS in backend/.env set to include http://localhost:3000?
 *   3. Is NEXT_PUBLIC_API_URL in frontend/.env.local pointing at the right port?
 */
export class NetworkError extends Error {
  constructor(public readonly url: string, cause: Error) {
    super(`Network error fetching ${url}: ${cause.message}`)
    this.name = 'NetworkError'
    this.cause = cause
  }
}
