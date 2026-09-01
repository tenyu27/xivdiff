# xivdiff

Vite + React 19 SPA in TypeScript. Currently the default Vite starter template — no app code yet.

## Commands

- `yarn dev` — start dev server (Vite, HMR)
- `yarn build` — typecheck (`tsc -b`) then production build (`vite build`)
- `yarn lint` — run oxlint
- `yarn preview` — serve the production build locally

Use **yarn** (yarn.lock is committed). Node 24.

## Stack

- **React 19** with the **React Compiler** enabled — do not hand-write `useMemo`/`useCallback`/`memo` for perf; the compiler handles memoization. Add them only when semantically required.
- **TypeScript** — strict bundler mode, `verbatimModuleSyntax` on, so use `import type` for type-only imports. `.tsx`/`.ts` extensions allowed in import paths.
- **Vite 8** (Rolldown). Config in `vite.config.ts`; Babel plugin wires the React Compiler preset.
- **oxlint** for linting (config `.oxlintrc.json`), not ESLint. Rules: `react/rules-of-hooks`, `react/only-export-components`.

## Layout

- `src/main.tsx` — entry, mounts `<App />` in `StrictMode`
- `src/App.tsx` — root component
- `src/*.css` — plain CSS, imported per-component
- `src/assets/` — imported assets (bundled)
- `public/` — static assets served at root (`favicon.svg`, `icons.svg`)
- `index.html` — HTML entry, root is `#root`

## TS project structure

Three tsconfigs: `tsconfig.json` (references only), `tsconfig.app.json` (`src`, DOM libs), `tsconfig.node.json` (Vite config). `yarn build` runs `tsc -b` across the references.
