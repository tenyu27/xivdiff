# xivdiff

Visually diff two FFXIV rotations from FFLogs.

Paste two FFLogs reports, pick a pull and a player on each side, and both
rotations render on one shared timeline — every GCD and every weave, aligned by
encounter time, with missing actions, extra actions, substitutions and timing
drift called out so you can step between them.

It is not a rotation analyser. It answers one question: *what exactly did I do
differently from this other pull?*

## Architecture

```
GitHub Pages (static SPA)          Cloudflare Worker            External
─────────────────────────          ─────────────────            ────────
  landing / compare UI  ─────────▶  /api/fflogs proxy  ────────▶  FFLogs GraphQL v2
  comparison engine                 holds client creds            (OAuth client_credentials)
  timeline renderer                 caches responses
          │
          └──────────────────────────────────────────────────▶  XIVAPI v2
                                                                 (icons, action metadata)
```

The site is fully static. FFLogs requires a `client_id`/`client_secret` pair
that must never ship in a browser bundle, so a small Cloudflare Worker holds the
credentials and proxies GraphQL queries. XIVAPI v2 is called directly from the
browser — it is public, CORS-open, and needs no key.

Routing is hash-based (`#/compare?...`), so GitHub Pages needs no rewrite rules
and a shared link survives a refresh. Comparison state lives entirely in that
URL, which is what makes a link pasted into Discord reconstruct the same view
with no database behind it.

## Layout

- `src/lib/` — the non-visual core: FFLogs URL parsing, the API clients, the
  job table, the comparison engine (`diff.ts`) and timeline placement
  (`layout.ts`).
- `src/hooks/` — the hash router, the per-side loading state machine, theming.
- `src/components/` — landing page, compare page, selectors, timeline, tooltip.
- `worker/` — the Cloudflare Worker FFLogs proxy. Deployed separately.

## Development

```sh
yarn install
yarn dev        # requires VITE_API_BASE to point at a proxy
yarn build      # tsc -b, then vite build
yarn lint       # oxlint
```

`VITE_API_BASE` is the deployed worker's origin. Without it the app loads and
reports the missing proxy inline rather than failing silently; you can also set
it at runtime under **Settings**, which is useful for pointing a public build at
your own worker.

## Deploying the worker

Register an API client at <https://www.fflogs.com/api/clients/> first.

```sh
cd worker
yarn install
npx wrangler login
yarn deploy                                  # prints the workers.dev URL
npx wrangler secret put FFLOGS_CLIENT_ID
npx wrangler secret put FFLOGS_CLIENT_SECRET
```

The deployed URL is `https://<name>.<account-subdomain>.workers.dev`, where
`<name>` is the `name` field in `wrangler.toml` — currently `fflogs-proxy`.
That URL is what `VITE_API_BASE` must point at.

Then set `ALLOWED_ORIGINS` in `worker/wrangler.toml` to your Pages origin and
redeploy. It is enforced by rejecting the request, not only through CORS
headers: those are advisory and honoured by browsers alone, so a header-only
allowlist would leave the proxy an open relay against your FFLogs quota.

Changing `name` does not rename a Worker — Cloudflare creates a new one, the
old one keeps running, and secrets do not follow. After a rename, re-run
`wrangler secret put` for both credentials and delete the old Worker with
`wrangler delete --name <old-name>`.

The worker caches on the exact query and variables for an hour. FFLogs reports
are immutable once uploaded, so two people comparing the same log cost FFLogs a
single request.

### Deploying it from CI instead

`.github/workflows/deploy-worker.yml` redeploys the worker on any push touching
`worker/`. It needs two repository secrets:

- `CLOUDFLARE_API_TOKEN` — My Profile → API Tokens → Create Token → **Edit
  Cloudflare Workers**. Scope it to the one account; do not use a global API key.
- `CLOUDFLARE_ACCOUNT_ID` — shown in the Workers overview sidebar.

The two FFLogs secrets stay out of CI entirely: `wrangler secret put` stores
them on Cloudflare and they survive redeploys, so CI only ever ships code.

## Deploying the site

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every
push to `main`. Two one-time setup steps:

1. **Settings → Pages → Source: GitHub Actions.**
2. **Settings → Secrets and variables → Actions → Variables**: add
   `VITE_API_BASE` with your worker's URL.

The Vite `base` is `'./'`, so the build works at a user-site root or a project
-site subpath without reconfiguration.

## Scope

V1 covers public reports only — no login, no private-report authorization, no
accounts. Desktop only: the two-track comparison needs horizontal space, so
below 1280px the app shows a notice instead of a degraded layout.

Deliberately out of scope: DPS and parse comparison, rotation scoring,
recommendations, buff and resource timelines, potency maths, and automatic phase
synchronisation. Fight start is `0:00`; if one player opens two seconds later,
that stays visible.
