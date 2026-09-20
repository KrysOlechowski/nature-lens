# 📍 Project State

> **Project:** Nature Lens
>
> **Status:** frontend, API, and shared developer tooling bootstrapped
>
> **Current phase:** Phase 1 · Repository foundation
>
> **Last completed step:** 04 · Configure shared developer tooling
>
> **Current step:** 05 · Add typed environment configuration
>
> **Next step:** 06 · Add API health endpoint

## What currently works

- pnpm workspace recognizes the root package and the `web` and `api` packages.
- Root and application package manifests are private.
- pnpm is pinned to `12.4.1` through `packageManager`; the lockfile is generated.
- `web` runs Next.js 16 with App Router, React 19, TypeScript, and Tailwind CSS 4.
- `/` renders a minimal English Nature Lens welcome page with responsive styling, English page metadata, and `lang="en"`.
- Frontend development, production build, production server, and TypeScript checks can be run from the repository root.
- `api` runs NestJS 12 on port 3001 without a database or environment variables, with a global `/api` route prefix.
- Backend development with automatic recompilation/restart, production build, production server, and TypeScript checks can be run from the repository root.
- Root commands lint, typecheck, build, and format both applications consistently.
- ESLint applies Next.js Core Web Vitals rules to `web` and recommended TypeScript and Node.js rules to `api`.
- Prettier can check or update formatting across the repository with shared defaults and LF line endings.
- `.gitignore` excludes dependencies, build output, local environment files, logs, and `.DS_Store`, while allowing environment examples.

## Important current decisions

- English is the project language for UI copy, messages, metadata, code comments, and documentation. The product remains focused on Poland.
- Applications live directly in `web/` and `api/`, without an `apps/` directory.
- Plain pnpm workspaces are sufficient; no Nx or Turborepo is introduced.
- `web/app/layout.tsx` owns the HTML document and metadata; `web/app/page.tsx` renders the home page. Both are Server Components; no client interaction is needed yet.
- Tailwind uses its PostCSS plugin. System fonts keep the page independent of external font downloads.
- Root `dev:web` and `dev:api` start the applications separately; other scripts use `pnpm --filter web` or `pnpm --filter api`. Shared tooling remains in step 04.
- Frontend `typecheck` runs Next.js type generation before TypeScript so it also works before the first build.
- The API uses the default Express adapter, native ES modules, and strict TypeScript with decorator metadata. `main.ts` bootstraps the server; `AppModule` is the root module. No placeholder controllers, providers, or feature modules are introduced.
- API port 3001 is fixed for this bootstrap; typed environment configuration belongs to step 05.
- ESLint uses one root flat config scoped to each application; formatting rules are delegated to Prettier rather than duplicated in ESLint.
- Shared developer tooling stays at the workspace root instead of introducing a publishable config package or custom configuration framework.
- The optional `unrs-resolver` install script is explicitly disabled; the installed prebuilt resolver works without approving it.
- Next.js automatic agent-file generation is disabled; repository instructions remain in the root `AGENTS.md`.
- The target remains Next.js → Nature Lens API (NestJS modular monolith) → provider adapters and PostgreSQL/PostGIS on Supabase.
- The first vertical slice is species search and real observations from Poland on a map, initially using iNaturalist. External data must be runtime-validated and normalized, and provider coordinate restrictions must be preserved.

## Known limitations / blockers

- The API has no controllers yet; HTTP 404 responses are expected. The health endpoint belongs to step 06.
- The frontend is a static starting point: no species search, map, database, or provider integration exists yet.
- Application tests, CI, and deployment are not configured yet.
- Node.js 23.3.0 fails to load a Nest CLI dependency. Backend build and runtime checks passed on the locally installed Node.js 22.22.0. The full CLI toolchain, including generators, requires Node.js 22.22.3+ (22.x) or 24.15+ (24.x); runtime version pinning is not configured yet.
- The agent environment blocks the local ports used by development servers and by Turbopack's CSS processing. The frontend production build passes with webpack; the default Turbopack build must be run in an unrestricted local environment. No application blocker remains.

## Development commands

Run from the repository root with pnpm 12.4.1 available and a compatible Node.js version selected (see README):

```bash
pnpm install
pnpm lint
pnpm format:check
pnpm format
pnpm typecheck
pnpm build
pnpm dev:web
pnpm --filter web start
pnpm dev:api
pnpm --filter api start
```

Run the development servers in separate terminals. The frontend uses http://localhost:3000; the API uses http://localhost:3001. Run each application's `build` before its `start`.

## Verification

- `pnpm install --frozen-lockfile`: passed.
- `pnpm peers check`: passed with no peer dependency issues.
- `pnpm lint`: passed for `web` and `api`.
- `pnpm format:check`: passed.
- `pnpm typecheck`: passed for `web` and `api` on Node.js 22.22.0.
- `pnpm --filter api build`: passed on Node.js 22.22.0.
- `pnpm --filter web exec next build --webpack`: passed on Node.js 22.22.0.
- `pnpm build`: launched both application builds, but the default frontend Turbopack build could not complete because the agent environment blocked its local CSS-processing port.
- `git diff --check`: passed.
- Step 04 Definition of Done is satisfied: root commands provide one entry point for checking both applications.

## Next implementation

Implement only **05 · Add typed environment configuration** after discussing and approving its approach. See its section in `IMPLEMENTATION_PLAN.md`.
