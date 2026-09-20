# 📍 Project State

> **Project:** Nature Lens
>
> **Status:** frontend bootstrapped
>
> **Current phase:** Phase 1 · Repository foundation
>
> **Last completed step:** 02 · Bootstrap Next.js application
>
> **Current step:** 03 · Bootstrap NestJS API
>
> **Next step:** 04 · Configure shared developer tooling

## What currently works

- pnpm workspace recognizes the root package and the `web` and `api` packages.
- Root and application package manifests are private.
- pnpm is pinned to `12.4.1` through `packageManager`; the lockfile is generated.
- `web` runs Next.js 16 with App Router, React 19, TypeScript, and Tailwind CSS 4.
- `/` renders a minimal Polish Nature Lens welcome page with responsive styling and page metadata.
- Frontend development, production build, production server, and TypeScript checks can be run from the repository root.
- `.gitignore` excludes dependencies, build output, local environment files, logs, and `.DS_Store`, while allowing environment examples.

## Important current decisions

- Applications live directly in `web/` and `api/`, without an `apps/` directory.
- Plain pnpm workspaces are sufficient; no Nx or Turborepo is introduced.
- `web/app/layout.tsx` owns the HTML document and metadata; `web/app/page.tsx` renders the home page. Both are Server Components; no client interaction is needed yet.
- Tailwind uses its PostCSS plugin. System fonts keep the page independent of external font downloads.
- Root `dev:web` starts the frontend; other frontend scripts are invoked with `pnpm --filter web`. Shared tooling remains in step 04.
- `typecheck` runs Next.js type generation before TypeScript so it also works before the first build.
- Next.js automatic agent-file generation is disabled; repository instructions remain in the root `AGENTS.md`.
- The target remains Next.js → Nature Lens API (NestJS modular monolith) → provider adapters and PostgreSQL/PostGIS on Supabase.
- The first vertical slice is species search and real observations from Poland on a map, initially using iNaturalist. External data must be runtime-validated and normalized, and provider coordinate restrictions must be preserved.

## Known limitations / blockers

- `api` contains only its package manifest; NestJS has not been bootstrapped.
- The frontend is a static starting point: no species search, map, database, or provider integration exists yet.
- Shared linting/formatting, application tests, CI, and deployment are not configured yet.
- Verification required running the server and build outside the agent sandbox because it blocks local ports used by Next.js/Turbopack. No application blocker remains.

## Development commands

Run from the repository root with pnpm 12.4.1 available:

```bash
pnpm install
pnpm dev:web
pnpm --filter web typecheck
pnpm --filter web build
pnpm --filter web start
```

Open http://localhost:3000 after starting the server. Run `build` before `start`.

## Verification

- `pnpm install --frozen-lockfile`: passed.
- `pnpm --filter web typecheck`: passed.
- `pnpm --filter web build`: passed; `/` is statically prerendered.
- `pnpm dev:web`: served the welcome page successfully in the browser.
- `pnpm --filter web start`: HTTP 200; production page visually checked at desktop and mobile widths.
- `git diff --check`: passed.
- Step 02 Definition of Done is satisfied: `web` runs locally and renders a simple Nature Lens page.

## Next implementation

Implement only **03 · Bootstrap NestJS API** after discussing and approving its approach. See its section in `IMPLEMENTATION_PLAN.md`.
