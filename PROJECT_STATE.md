# 📍 Project State

> **Project:** Nature Lens
>
> **Status:** frontend, API, PostgreSQL, and PostGIS connected
>
> **Current phase:** Phase 2 · PostgreSQL and PostGIS
>
> **Last completed step:** 11 · Add Observation geospatial model
>
> **Current step:** 12 · Add spatial and lookup indexes
>
> **Next step:** 13 · Add persistence integration test foundation

## What currently works

- pnpm workspace recognizes the root package and the `web` and `api` packages.
- Root and application package manifests are private.
- pnpm is pinned to `12.4.1` through `packageManager`; the lockfile is generated.
- `web` runs Next.js 16 with App Router, React 19, TypeScript, and Tailwind CSS 4.
- `/` renders a minimal English Nature Lens welcome page with responsive styling, English page metadata, `lang="en"`, and the current API connection status.
- The Next.js Server Component fetches and validates `GET /api/health`; network, HTTP, and contract failures render a non-fatal unavailable state.
- Frontend development, production build, production server, and TypeScript checks can be run from the repository root.
- `api` runs NestJS 12 with a global `/api` route prefix and a PostgreSQL connection to the development Supabase project.
- The API validates its server-only database configuration, creates one bounded PostgreSQL connection pool per process, verifies the connection before startup, and closes the pool during application shutdown.
- The development connection string is stored locally in the ignored `api/.env` file and uses the Supabase Session pooler for IPv4 compatibility.
- Database schema changes are versioned as TypeScript migrations in `api/migrations` and can be applied explicitly from the repository root.
- The first migration creates the dedicated `extensions` schema, enables PostGIS there, and records its application in the migration history.
- The `species` table stores application-owned species identities, scientific and display names, basic taxonomy, and timestamps independently of external providers.
- The `observations` table relates normalized biodiversity observations to species and stores their observation time, WGS84 point location, positional accuracy, obscured-location status, provider identity, external identifier, and source URL.
- `GET /api/health` returns a stable `200` response with status and API contract version fields.
- Backend development with automatic recompilation/restart, production build, production server, and TypeScript checks can be run from the repository root.
- `web` validates its public API base URL when Next.js loads; `api` loads its local `.env` file and validates its port, PostgreSQL URL, and pool size before NestJS starts.
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
- The health endpoint uses a thin controller and a dedicated response DTO. Its version field identifies the health response contract rather than the package release version.
- Zod schemas are the only entry points from untyped environment variables into application code. The applications keep separate schemas rather than introducing a shared configuration package before one is needed.
- `NEXT_PUBLIC_API_BASE_URL` is intentionally public and build-time configuration for browser code. It must never contain a secret.
- The home page health check runs server-side with caching disabled, so it reflects the API state for each page request without requiring browser CORS configuration.
- The frontend validates the health response at its network boundary and treats unexpected HTTP responses or payloads as API unavailability.
- `PORT` remains server-only runtime configuration. The API loads local values with `dotenv`, coerces the string to a number, and rejects values outside the valid TCP port range.
- ESLint uses one root flat config scoped to each application; formatting rules are delegated to Prettier rather than duplicated in ESLint.
- Shared developer tooling stays at the workspace root instead of introducing a publishable config package or custom configuration framework.
- The optional `unrs-resolver` install script is explicitly disabled; the installed prebuilt resolver works without approving it.
- Next.js automatic agent-file generation is disabled; repository instructions remain in the root `AGENTS.md`.
- The target remains Next.js → Nature Lens API (NestJS modular monolith) → provider adapters and PostgreSQL/PostGIS on Supabase.
- The development database uses Supabase without the GitHub integration, automatic RLS event trigger, or dedicated IPv4 add-on; these can be introduced later if a concrete requirement justifies them.
- PostgreSQL access uses the low-level `pg` driver so application code can use parameterized SQL and PostGIS directly without an ORM-specific persistence model.
- `DatabaseService` owns one `pg.Pool` per API process. The pool defaults to at most five connections, can be configured with `DATABASE_POOL_MAX`, and is shared by modules that import `DatabaseModule`.
- Database availability is required for the API to start; an initial `SELECT 1` fails fast when credentials or connectivity are invalid.
- `node-pg-migrate` manages schema evolution without introducing an ORM. Migrations run through explicit commands rather than during API startup.
- PostGIS is installed in the dedicated `extensions` schema instead of `public`, keeping extension-owned objects outside the schema exposed by the Supabase Data API.
- The PostGIS down migration uses `DROP EXTENSION` without `CASCADE`, so PostgreSQL refuses an unsafe rollback when dependent spatial objects exist. The shared `extensions` schema is intentionally preserved.
- Species use an identity-backed internal `bigint` primary key. Scientific names are required and unique; display names and taxonomy fields remain optional because providers may not supply them consistently.
- Species text constraints reject blank values while preserving `NULL` for genuinely unavailable optional data. Provider-specific identifiers do not belong to the core species table.
- Species timestamps default to the insertion time. Future persistence writes will maintain `updated_at`; no database trigger is introduced before update behavior exists.
- Observations use PostGIS `geometry(Point, 4326)` because the initial product needs map and bounding-box queries over WGS84 coordinates; distance calculations that could justify `geography` are not required yet.
- Observation coordinates must be nonempty and stay within valid longitude and latitude ranges. Positional accuracy is optional, measured in meters, and must be finite and nonnegative when present.
- Observation location obscurity uses a nullable boolean: `true` means obscured, `false` means explicitly unobscured, and `NULL` means the provider did not supply enough information. Unknown sensitivity metadata must never be interpreted as an unobscured location.
- Observation provenance is stored as a nonblank provider, provider-scoped external identifier, and source URL. Provider/external-ID uniqueness and query indexes belong to the next step.
- Deleting a species referenced by observations is restricted so observation records cannot become detached from their normalized species identity.
- The first vertical slice is species search and real observations from Poland on a map, initially using iNaturalist. External data must be runtime-validated and normalized, and provider coordinate restrictions must be preserved.

## Known limitations / blockers

- The API currently exposes only the health endpoint; domain endpoints begin in later steps.
- The frontend only reports API health: no species search, map, domain persistence, or provider integration exists yet.
- Observation spatial and lookup indexes are not present yet; they are the focus of step 12.
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
pnpm db:migrate
pnpm db:migrate:create migration-name
pnpm db:migrate:down
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
- `pnpm --filter api typecheck`: passed after adding the health endpoint.
- `pnpm lint`: passed after adding the health endpoint.
- Targeted Prettier check for the changed API source files: passed.
- Runtime request to `GET /api/health`: returned `200 OK` with `{"status":"ok","version":"1"}`.
- Runtime request to the production frontend with the API available rendered `Connected · contract v1`.
- Runtime request to the production frontend with an unreachable API rendered `Unavailable` without failing the page.
- `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001 pnpm --filter web exec next build --webpack`: passed.
- API startup checks rejected a missing `PORT` and a port above 65535 before NestJS started.
- Next.js type generation rejected a missing API URL and a non-HTTP(S) API URL while loading its configuration.
- `pnpm build`: launched both application builds, but the default frontend Turbopack build could not complete because the agent environment blocked its local CSS-processing port.
- `git diff --check`: passed.
- Step 07 Definition of Done is satisfied: Next.js fetches the NestJS health response without contacting an external provider and handles network failure gracefully.
- Manual Supabase setup is complete: the development project exists and its connection string is stored locally outside Git.
- `pnpm --filter api typecheck`: passed after adding PostgreSQL access.
- `pnpm --filter api build`: passed.
- `pnpm lint`: passed for `web` and `api`.
- `pnpm format:check`: passed.
- Configuration startup check rejected a non-PostgreSQL `DATABASE_URL` before NestJS initialization.
- API startup connected to the development Supabase database through the Session pooler and completed `SELECT 1`.
- Runtime request to `GET /api/health` returned `200 OK` with `{"status":"ok","version":"1"}` while the database connection was active.
- `pnpm peers check`: passed with no peer dependency issues.
- `git check-ignore -v api/.env`: confirmed that the local connection string remains ignored by Git.
- Step 08 Definition of Done is satisfied: the API connects to PostgreSQL and executes a connection check before accepting requests.
- `pnpm --filter api typecheck`: passed for the API source and TypeScript migrations.
- `pnpm lint`: passed for `web` and `api`.
- `pnpm format:check`: passed.
- `git diff --check`: passed.
- Migration dry run generated `CREATE SCHEMA IF NOT EXISTS extensions`, `CREATE EXTENSION postgis SCHEMA extensions`, and the migration-history insert without modifying the database.
- `pnpm db:migrate`: applied `20260921183645533_enable-postgis` to the development Supabase database.
- A second `pnpm db:migrate` reported no pending migrations.
- Database inspection confirmed PostGIS `3.3.7` in the `extensions` schema and the migration in `public.pgmigrations`; `extensions.postgis_version()` executed successfully.
- Down-migration dry run generated restrictive `DROP EXTENSION postgis` without `CASCADE` and removal of the migration-history entry.
- Step 09 Definition of Done is satisfied: the database migration history is repository-owned, and applying the migrations enables a working PostGIS installation without manual dashboard setup.
- `pnpm --filter api typecheck`: passed for the species migration.
- Targeted Prettier check for the species migration: passed.
- Migration dry run generated the `species` table with an identity primary key, required unique scientific name, optional taxonomy, nonblank text constraints, and timestamp defaults.
- `pnpm db:migrate`: applied `20260922151205000_add-species-model` to the development Supabase database.
- A second `pnpm db:migrate` reported no pending migrations.
- Database inspection confirmed all species columns, identity and timestamp defaults, primary key, unique scientific name, nonblank text constraints, and migration-history entry.
- Down-migration dry run generated `DROP TABLE "species"` and removal of the migration-history entry without modifying the database.
- Step 10 Definition of Done is satisfied: a repository-owned migration creates the provider-independent species table with sensible constraints.
- `pnpm --filter api typecheck`: passed for the observation migration.
- `pnpm lint`: passed for `web` and `api` after adding the observation migration.
- Targeted Prettier check for the observation migration: passed.
- Migration dry run generated the `observations` table with a species foreign key, WGS84 point, observation metadata, coordinate and accuracy constraints, and provider provenance.
- `pnpm --filter api db:migrate`: applied `20260922154444000_add-observation-geospatial-model` to the development Supabase database.
- A second migration run reported no pending migrations.
- Database inspection confirmed the observation columns, nullable boolean obscurity status, PostGIS geometry type in the `extensions` schema, constraints, foreign key, and migration-history entry.
- A transactionally rolled-back verification insert persisted a Warsaw point with SRID 4326 and source information; a longitude of `181` was rejected by `observations_location_check` with SQLSTATE `23514`.
- A transactionally rolled-back verification confirmed that `location_obscured` preserves all three semantic states: `true`, `false`, and `NULL`.
- Down-migration dry run generated `DROP TABLE "observations"` and removal of the migration-history entry without modifying the database.
- Step 11 Definition of Done is satisfied: the database can persist a valid observation point with its species relationship, sensitivity metadata, and source provenance.

## Next implementation

Discuss and approve **12 · Add spatial and lookup indexes** before implementing it. See the corresponding section in `IMPLEMENTATION_PLAN.md`.
