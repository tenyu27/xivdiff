/**
 * xivdiff FFLogs proxy.
 *
 * GitHub Pages serves static files only, and FFLogs credentials must never
 * reach the browser, so this worker holds the client credentials, exchanges
 * them for an access token, and forwards GraphQL queries.
 *
 * Deploy separately from the site:
 *   cd worker && yarn install && yarn deploy
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

interface OriginCheck {
  allowed: boolean
  headers: Record<string, string>
}

/**
 * CORS headers alone are not access control — they are advisory, and only a
 * browser honours them. `curl` and any script ignore them outright, so the
 * allowlist has to be enforced by refusing the request as well, or the proxy
 * stays an open relay against the account's FFLogs quota.
 */
function checkOrigin(request: Request, env: Env): OriginCheck {
  const origin = request.headers.get('origin')
  const allowlist = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)

  const unrestricted = allowlist.length === 0
  const allowed = unrestricted || (origin != null && allowlist.includes(origin))

  return {
    allowed,
    headers: {
      // Never echo an origin that was rejected.
      'access-control-allow-origin': allowed ? (origin ?? '*') : allowlist[0],
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'access-control-max-age': '86400',
      vary: 'Origin',
    },
  }
}

function json(
  body: unknown,
  status: number,
  headers: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'content-type': 'application/json' },
  })
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const { allowed, headers: cors } = checkOrigin(request, env)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: allowed ? 204 : 403, headers: cors })
    }

    const url = new URL(request.url)

    // Left open so the deployment can be health-checked without an Origin.
    if (url.pathname === '/health') {
      return json({ ok: true }, 200, cors)
    }

    if (url.pathname !== '/api/fflogs' || request.method !== 'POST') {
      return json({ error: 'Not found.' }, 404, cors)
    }

    if (!allowed) {
      return json({ error: 'Origin not allowed.' }, 403, cors)
    }

    if (!env.FFLOGS_CLIENT_ID || !env.FFLOGS_CLIENT_SECRET) {
      return json({ error: 'The proxy is missing FFLogs credentials.' }, 500, cors)
    }

    let body: { query?: unknown; variables?: unknown }
    try {
      body = (await request.json()) as typeof body
    } catch {
      return json({ error: 'Malformed request body.' }, 400, cors)
    }

    if (typeof body.query !== 'string') {
      return json({ error: 'Missing GraphQL query.' }, 400, cors)
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
      for (const [key, value] of Object.entries(cors)) hit.headers.set(key, value)
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
      return json({ error: 'Could not reach FFLogs.' }, 502, cors)
    }

    if (upstream.status === 401) {
      // The cached token was rejected; drop it so the next call re-authenticates.
      token = null
      return json({ error: 'The proxy could not authenticate with FFLogs.' }, 502, cors)
    }

    if (upstream.status === 429) {
      return json({ error: 'FFLogs rate limit reached.' }, 429, cors)
    }

    if (!upstream.ok) {
      return json({ error: `FFLogs returned ${upstream.status}.` }, 502, cors)
    }

    const text = await upstream.text()

    const response = new Response(text, {
      status: 200,
      headers: {
        ...cors,
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
