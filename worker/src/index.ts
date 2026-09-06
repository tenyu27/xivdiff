/**
 * xivdiff FFLogs proxy.
 *
 * FFLogs credentials must never reach the browser, so this Worker holds the
 * client credentials, exchanges them for an access token, and forwards GraphQL
 * queries. It ships in the same Worker as the SPA: static assets are matched
 * first, and `/api/fflogs` is the one path with no file behind it, so it is
 * the only request that arrives here.
 *
 * Deploy with the site, from the repository root:
 *   yarn deploy
 *   wrangler secret put FFLOGS_CLIENT_ID
 *   wrangler secret put FFLOGS_CLIENT_SECRET
 */

interface Env {
  FFLOGS_CLIENT_ID: string
  FFLOGS_CLIENT_SECRET: string
  /** Comma-separated origin allowlist. Omit to allow any origin. */
  ALLOWED_ORIGINS?: string
}

const TOKEN_URL = 'https://www.fflogs.com/oauth/token'
const GRAPHQL_URL = 'https://www.fflogs.com/api/v2/client'

/** Report data is immutable once uploaded, so caching it is safe and cheap. */
const CACHE_SECONDS = 3600

interface TokenState {
  value: string
  expiresAt: number
}

// Held per isolate. A cold isolate simply fetches a fresh token.
let token: TokenState | null = null
let tokenRequest: Promise<string> | null = null

async function getToken(env: Env): Promise<string> {
  if (token && token.expiresAt > Date.now() + 60_000) return token.value

  // Collapse concurrent misses into a single token request.
  tokenRequest ??= fetchToken(env).finally(() => {
    tokenRequest = null
  })

  return tokenRequest
}

async function fetchToken(env: Env): Promise<string> {
  const credentials = btoa(
    `${env.FFLOGS_CLIENT_ID}:${env.FFLOGS_CLIENT_SECRET}`,
  )

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      authorization: `Basic ${credentials}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!response.ok) {
    throw new Error(`FFLogs token request failed (${response.status})`)
  }

  const payload = (await response.json()) as {
    access_token: string
    expires_in: number
  }

  token = {
    value: payload.access_token,
    expiresAt: Date.now() + payload.expires_in * 1000,
  }

  return token.value
}

/**
 * The SPA is same-origin with this proxy, so no CORS headers are owed to it and
 * none are sent. The allowlist is not CORS and never was: CORS is advisory and
 * only a browser honours it, so the check has to refuse the request outright or
 * the proxy is an open relay against the account's FFLogs quota. A same-origin
 * POST still carries an `Origin` header, so the allowlist keeps working.
 */
function isAllowedOrigin(request: Request, env: Env): boolean {
  const origin = request.headers.get('origin')
  const allowlist = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)

  if (allowlist.length === 0) return true
  return origin != null && allowlist.includes(origin)
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url)

    // Left open so the deployment can be health-checked without an Origin.
    if (url.pathname === '/health') {
      return json({ ok: true }, 200)
    }

    if (url.pathname !== '/api/fflogs' || request.method !== 'POST') {
      return json({ error: 'Not found.' }, 404)
    }

    if (!isAllowedOrigin(request, env)) {
      return json({ error: 'Origin not allowed.' }, 403)
    }

    if (!env.FFLOGS_CLIENT_ID || !env.FFLOGS_CLIENT_SECRET) {
      return json({ error: 'The proxy is missing FFLogs credentials.' }, 500)
    }

    let body: { query?: unknown; variables?: unknown }
    try {
      body = (await request.json()) as typeof body
    } catch {
      return json({ error: 'Malformed request body.' }, 400)
    }

    if (typeof body.query !== 'string') {
      return json({ error: 'Missing GraphQL query.' }, 400)
    }

    const payload = JSON.stringify({
      query: body.query,
      variables: body.variables ?? {},
    })

    // Cache on the exact query + variables. Two users comparing the same log
    // then cost FFLogs a single request.
    const cacheKey = new Request(
      `${url.origin}/cache/${await digest(payload)}`,
      { method: 'GET' },
    )
    const cache = caches.default

    const cached = await cache.match(cacheKey)
    if (cached) {
      const hit = new Response(cached.body, cached)
      hit.headers.set('x-cache', 'HIT')
      return hit
    }

    let upstream: Response
    try {
      upstream = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${await getToken(env)}`,
          'content-type': 'application/json',
        },
        body: payload,
      })
    } catch {
      return json({ error: 'Could not reach FFLogs.' }, 502)
    }

    if (upstream.status === 401) {
      // The cached token was rejected; drop it so the next call re-authenticates.
      token = null
      return json({ error: 'The proxy could not authenticate with FFLogs.' }, 502)
    }

    if (upstream.status === 429) {
      return json({ error: 'FFLogs rate limit reached.' }, 429)
    }

    if (!upstream.ok) {
      return json({ error: `FFLogs returned ${upstream.status}.` }, 502)
    }

    const text = await upstream.text()

    const response = new Response(text, {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'cache-control': `public, max-age=${CACHE_SECONDS}`,
        'x-cache': 'MISS',
      },
    })

    // Only successful GraphQL responses are worth keeping.
    if (!text.includes('"errors"')) {
      ctx.waitUntil(cache.put(cacheKey, response.clone()))
    }

    return response
  },
} satisfies ExportedHandler<Env>

async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  )
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}
