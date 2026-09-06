/**
 * The FFLogs proxy is served by the same Worker as this bundle, so the path is
 * relative and there is no build-time base to configure. `vite dev` reaches it
 * through the `/api` proxy in vite.config.ts.
 */
const FFLOGS_ENDPOINT = '/api/fflogs'

/** A message already phrased for the user; the UI renders it verbatim. */
export class ApiError extends Error {}

export async function graphql<T>(
  query: string,
  variables: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response
  try {
    response = await fetch(FFLOGS_ENDPOINT, {
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
