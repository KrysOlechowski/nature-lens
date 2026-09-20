# 📍 Project State

> **Project:** Nature Lens
>
> **Status:** frontend, API, and shared developer tooling bootstrapped
>
> **Current phase:** Phase 1 · Repository foundation
>
> **Last completed step:** 05 · Add typed environment configuration
>
> **Current step:** 06 · Add API health endpoint
>
> **Next step:** 07 · Connect Next.js to Nature Lens API

## What currently works

- pnpm workspace recognizes the root package and the `web` and `api` packages.
- Root and application package manifests are private.
- pnpm is pinned to `12.4.1` through `packageManager`; the lockfile is generated.
- `web` runs Next.js 16 with App Router, React 19, TypeScript, and Tailwind CSS 4.
- `/` renders a minimal English Nature Lens welcome page with responsive styling, English page metadata, and `lang="en"`.
- Frontend development, production build, production server, and TypeScript checks can be run from the repository root.
- `api` runs NestJS 12 without a database, using a validated `PORT` environment variable and a global `/api` route prefix.
- Backend development with automatic recompilation/restart, production build, production server, and TypeScript checks can be run from the repository root.
- `web` validates its public API base URL when Next.js loads; `api` loads its local `.env` file and validates its port before NestJS starts.
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
- Zod schemas are the only entry points from untyped environment variables into application code. The applications keep separate schemas rather than introducing a shared configuration package before one is needed.
- `NEXT_PUBLIC_API_BASE_URL` is intentionally public and build-time configuration for browser code. It must never contain a secret.
- `PORT` remains server-only runtime configuration. The API loads local values with `dotenv`, coerces the string to a number, and rejects values outside the valid TCP port range.
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
cp web/.env.example web/.env.local
cp api/.env.example api/.env
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

- `pnpm install --frozen-lockfile`: passed with the final lockfile.
- `pnpm peers check`: passed with no peer dependency issues.
- `pnpm lint`: passed for `web` and `api`.
- `pnpm format:check`: passed.
- `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001 PORT=3001 pnpm typecheck`: passed for `web` and `api`.
- `pnpm --filter api build`: passed.
- `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001 pnpm --filter web exec next build --webpack`: passed.
- API startup checks rejected a missing `PORT` and a port above 65535 before NestJS started.
- Next.js type generation rejected a missing API URL and a non-HTTP(S) API URL while loading its configuration.
- `pnpm build`: launched both application builds, but the default frontend Turbopack build could not complete because the agent environment blocked its local CSS-processing port.
- `git diff --check`: passed.
- Step 05 Definition of Done is satisfied: both applications fail fast on missing required configuration, typed validated values replace raw environment access in application code, and only example environment files are tracked.

## Next implementation

Implement only **06 · Add API health endpoint** after discussing and approving its approach. See its section in `IMPLEMENTATION_PLAN.md`.
