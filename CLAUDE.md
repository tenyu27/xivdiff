# xivdiff

Vite + React 19 SPA in TypeScript. A tool for visually diffing two FFXIV
rotations pulled from FFLogs. See `PRD.md` for scope and `DESIGN.md` for the
design system — both are authoritative; where a rule and the code disagree, the
rule wins.

## Commands

- `yarn dev` — start dev server (Vite, HMR)
- `yarn build` — typecheck (`tsc -b`) then production build (`vite build`)
- `yarn lint` — run oxlint
- `yarn preview` — serve the production build locally

Use **yarn** (yarn.lock is committed). Node 24.

## Stack

- **React 19** with the **React Compiler** enabled — do not hand-write `useMemo`/`useCallback`/`memo` for perf; the compiler handles memoization. Add them only when semantically required.
- **TypeScript** — strict bundler mode, `verbatimModuleSyntax` on, so use `import type` for type-only imports. `.tsx`/`.ts` extensions allowed in import paths.
- **Vite 8** (Rolldown). Config in `vite.config.ts`; Babel plugin wires the React Compiler preset. `base` is `'./'` so the build works at any GitHub Pages path.
- **oxlint** for linting (config `.oxlintrc.json`), not ESLint.

## Architecture

Static site on GitHub Pages plus a Cloudflare Worker. FFLogs credentials must
never reach the browser, so `worker/` proxies FFLogs GraphQL and holds the
secrets; the SPA calls it at `VITE_API_BASE`. XIVAPI v2 is called directly from
the browser — public and CORS-open.

Routing is **hash-based** (`#/compare?...`): GitHub Pages has no rewrite rules,
so a real path route would 404 on refresh. The URL is the single source of
truth for comparison state — do not mirror it into component state.

## Layout

- `src/main.tsx` — entry, mounts `<App />` in `StrictMode`
- `src/App.tsx` — route switch, theme, and the minimum-width gate
- `src/lib/` — non-visual core, no React imports:
  - `diff.ts` — LCS comparison engine. Index-by-index comparison is wrong here; one extra weave would mark the rest of the fight as different.
  - `layout.ts` — timeline placement, plus every number-formatting helper
  - `api/` — the FFLogs proxy client, queries, and the XIVAPI metadata cache
  - `jobs.ts`, `fflogsUrl.ts`, `shareState.ts`, `types.ts`
- `src/hooks/` — `useRoute` (hash router store), `useSideData` (per-side loading state machine), `useTheme`
- `src/components/` — one `.css` file per component, imported alongside it
- `worker/` — the FFLogs proxy; its own package.json, deployed separately

## Conventions

- Both sides of a comparison load independently. An error on one side must never clear the other side's loaded state.
- Every number in the UI carries the `mono` class — timestamps, deltas, durations, counts. A column of timestamps that jitters horizontally is a defect.
- GCD/oGCD classification comes from XIVAPI's `ActionCategory` (Weaponskill/Spell vs Ability). No curated override list is needed.
- Colors are semantic CSS custom properties defined in `src/index.css`. Never write a raw hex in a component stylesheet, and never define a color only inside a theme block.
- No modals, no toasts, no spinners — selections and errors are inline, loading states are skeletons matching final dimensions.
