/** The FFLogs proxy worker, baked in at build time via `VITE_API_BASE`. */
const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/+$/, '')

/** A message already phrased for the user; the UI renders it verbatim. */
export class ApiError extends Error {}

export async function graphql<T>(
  query: string,
  variables: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  if (!API_BASE) {
    throw new ApiError('No FFLogs proxy is configured for this build.')
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE}/api/fflogs`, {
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
