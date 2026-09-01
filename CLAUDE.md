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
secrets; the SPA calls it at `VITE_API_BASE`, baked in at build time. XIVAPI v2
is called directly from the browser — public and CORS-open.

Routing is **hash-based** (`#/compare?...`): GitHub Pages has no rewrite rules,
so a real path route would 404 on refresh. The URL is the single source of
truth for comparison state — do not mirror it into component state.

## Layout

- `src/main.tsx` — entry, mounts `<App />` in `StrictMode`
- `src/App.tsx` — route switch, theme, and the minimum-width gate
- `src/lib/` — non-visual core, no React imports:
  - `diff.ts` — two aligners over shared phase splitting, one per view. `compareByOrder` (cast order) pins the GCD chain **by position**: the nth GCD of a phase is the nth GCD on both sides, the clock is never consulted, and oGCDs hang off the GCD they were woven after and pair within that slot by their own order — so an extra weave is reported in the slot it happened in instead of shifting every later one. `compareRotations` (cast timing) pairs **on the clock**. Never make one view borrow the other's aligner: each would then answer the other's question.
  - In the time-based aligner: **time decides the pairing, not the ability id.** Two presses at the same point in the phase are the same beat even when they are different abilities — that substitution is the finding, and matching by ability id (the old LCS) reported it instead as one side's `extra` stacked above the other's `missing`, which reads as a gap that is not there. Abilities only decide the verdict on a pair that time already joined. A GCD never pairs with an oGCD. Every tolerance is expressed in GCDs, never in round numbers — `SHORTEST_GCD_S` (1.9s, the fastest recast skill speed reaches) is the unit: one full GCD is the outer pairing window, half a GCD is the drift that makes a pair a `timing-difference`. The window is only an outer bound; within it `bestAvailable` prefers the genuinely closest candidate, and it has to, because any window wide enough for real drift also reaches the neighbouring GCD. Index-by-index comparison is wrong here too; one extra weave would mark the rest of the fight as different. Running one alignment across the whole fight is wrong at a larger scale — one phase-one divergence cascades through every later phase.
  - `phases.ts` — resolves each action's phase and phase-relative time
  - `layout.ts` — timeline placement, plus every number-formatting helper
  - `sequence.ts` — sequence placement: evenly spaced press order, with a break
    only where a side was idle past `GAP_THRESHOLD_S`
  - `api/` — the FFLogs proxy client, queries, and the XIVAPI metadata cache
  - `jobs.ts`, `fflogsUrl.ts`, `shareState.ts`, `types.ts`
- `src/hooks/` — `useRoute` (hash router store), `useSideData` (per-side loading state machine), `useTheme`
- `src/components/` — one `.css` file per component, imported alongside it
- `worker/` — the FFLogs proxy; its own package.json, deployed separately

## Conventions

- Both sides of a comparison load independently. An error on one side must never clear the other side's loaded state.
- Every number in the UI carries the `mono` class — timestamps, deltas, durations, counts. A column of timestamps that jitters horizontally is a defect.
- GCD/oGCD classification comes from XIVAPI's `ActionCategory` (Weaponskill/Spell vs Ability). No curated override list is needed.
- XIVAPI v2 has two batch traps, and both blank the whole timeline from a single bad row:
  - It returns an unresolved link as `{ "value": -1 }` with **no `fields` object**. Always chain through `?.fields?.x`.
  - It answers **404 for the entire `rows=` batch** if any one id has no Action row, and FFLogs emits synthetic ability ids that have none (`34603667`). `fetchRows` bisects a 404 to isolate them; never "simplify" that back to a flat request.
- An ability with no Action row behind it gets a placeholder carrying `unresolved: true`, and `dropUnresolved` in `useSideData` keeps those synthetic presses off the timeline entirely — drawn, one becomes a nameless iconless oGCD that pairs against a real press and reports a difference that did not happen. The one exception is when *every* ability is unresolved: that is an XIVAPI outage, not synthetic ids, so the actions are kept rather than claiming the pull was empty.
- Every timestamp shown or compared is phase-relative, never fight-relative. An unphased encounter is one phase starting at the pull, so the phase path is the only path.
- FFLogs is rate-limited and billed by points: report responses are cached by code and cast responses by `code:fight:actor`, both as promises so concurrent sides share one request. The worker additionally caches by query+variables digest. Never add a call path that bypasses those caches.
- Only real combat jobs are offered as players — `isPlayableJob` drops FFLogs' Limit Break pseudo-actor and untyped participants.
- Colors are semantic CSS custom properties defined in `src/index.css`. Never write a raw hex in a component stylesheet, and never define a color only inside a theme block.
- A verdict written as an icon outline and the same verdict written as a word are two different contrast problems: the outline is read against the game's own art, which is dark in both themes, the word against the page. So `--edge-match`/`--edge-diff`/`--edge-absent` are separate tokens from `--verdant`/`--ochre`/`--rose`, and in Paper Light they are the full-chroma versions — the darkened text colors collapse into one muddy band at 2px on dark art.
- UI glyphs are **Tabler** (`@tabler/icons-react`), sized and weighted once in `.btn svg`. Don't hand-roll an SVG or mix in a second icon set. Job icons are FFXIV art from XIVAPI and are not part of this.
- No modals, no toasts, no spinners — selections and errors are inline, loading states are skeletons matching final dimensions.
- Two comparison views, chosen from the header's **View** select and carried in
  the URL as `view=`. `sequence` — "Cast order", the default — is `Sequence.tsx`:
  every aligned pair is one evenly spaced row joined by a hairline across a
  centre column that is a bare separator, and time re-enters only as a break
  where one side was idle. `timeline` — "Cast timing" — is `Timeline.tsx`, which
  places rows on a phase-relative clock. Name a view for what it lets you read,
  never for how it is drawn. Both read the same `compareRotations` rows, so
  alignment work benefits both.
- The timeline's centre column carries time and nothing else. A row's verdict is the 2px border on its icon (verdant match / ochre difference / rose one-sided); its words go outboard of that icon, on the outer side of its own track. Each row also draws one hairline connector across the gutter, taking the row's colour and running only as far as the spine when a side has nothing; it is measured from the centre (`HALF_GUTTER + inset`) because the track columns are fluid and the gutter is not.
- Deliberately removed, pending a decision to bring them back: the difference count, prev/next difference navigation and its `J`/`K` bindings, the rendered timing delta, and the tooltip's timing-comparison block. `deltaMs` is still computed (it classifies `timing-difference`) but is never displayed. The header carries a phase filter instead, defaulting to all phases.
