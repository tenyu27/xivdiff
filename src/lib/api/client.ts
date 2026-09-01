const STORAGE_KEY = 'xivdiff.apiBase'

/**
 * The FFLogs proxy worker. Baked in at build time via `VITE_API_BASE`, but
 * overridable at runtime so a self-hoster can point a public build at their
 * own worker without rebuilding.
 */
export function getApiBase(): string {
  try {
    const override = localStorage.getItem(STORAGE_KEY)
    if (override) return override.replace(/\/+$/, '')
  } catch {
    // Private-mode browsers throw on storage access; fall through to the build value.
  }
  return (import.meta.env.VITE_API_BASE ?? '').replace(/\/+$/, '')
}

export function setApiBase(value: string): void {
  try {
    const trimmed = value.trim()
    if (trimmed) localStorage.setItem(STORAGE_KEY, trimmed)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to do — the in-memory session keeps working with the build value.
  }
}

/** A message already phrased for the user; the UI renders it verbatim. */
export class ApiError extends Error {}

export async function graphql<T>(
  query: string,
  variables: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const base = getApiBase()
  if (!base) {
    throw new ApiError(
      'No FFLogs proxy is configured for this build. Set one in Settings.',
    )
  }

  let response: Response
  try {
    response = await fetch(`${base}/api/fflogs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables }),
      signal,
    })
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error
    throw new ApiError('Could not reach the FFLogs proxy.')
  }

  if (response.status === 429) {
    throw new ApiError('FFLogs rate limit reached. Try again in a minute.')
  }

  const payload = (await response.json().catch(() => null)) as
    | { data?: T; errors?: { message: string }[]; error?: string }
    | null

  if (!response.ok) {
    throw new ApiError(payload?.error ?? 'The FFLogs proxy returned an error.')
  }
  if (payload?.errors?.length) {
    throw new ApiError(payload.errors[0].message)
  }
  if (!payload?.data) {
    throw new ApiError('The FFLogs proxy returned an empty response.')
  }

  return payload.data
}
