# Project State

> **Project:** Nature Lens
>
> **Status:** V1 is deployed, documented, and covered by CI plus production health and smoke checks
>
> **Current phase:** Phase 11 · Post-V1 extensions
>
> **Last completed step:** 64 · Document architecture and production runbook
>
> **Latest completed change:** Add database-backed API readiness check
>
> **Current step:** 65 · Add BDL forestry adapter
>
> **Next step:** 66 · Add forestry map layer and place section

## What currently works

- The pnpm workspace contains a Next.js 16 web application and a NestJS 12 modular-monolith API with shared formatting, linting, type-checking, testing, build, migration, and production-smoke commands.
- The production web application runs on Vercel, the API container runs on Render, and PostgreSQL/PostGIS runs on Supabase.
- Global search concurrently searches species and Polish places through independently validated, provider-neutral public contracts and preserves partial success.
- Species pages render persisted taxonomy, synchronize iNaturalist and mapped GBIF observation pages, show locally synchronized and conservatively deduplicated observations on a viewport-driven MapLibre map, and aggregate seasonality by month and year.
- Place pages resolve opaque Nominatim-backed identities, fit the map to reliable provider extents, query local observations for the actual viewport, show Open-Meteo conditions for the place center, and provide an independently toggleable GDOŚ protected-areas layer.
- Independent Suspense and error boundaries preserve useful page sections during provider failures. Observation synchronization exposes request-scoped `available`, `stale`, or `unavailable` provider metadata.
- External JSON is runtime-validated at provider boundaries, normalized into application-owned models, and translated into stable API errors. The frontend validates public API responses with Zod before rendering.
- Provider HTTP requests use per-provider timeouts, bounded retry where safe, categorized failures, structured logs, and request correlation.
- Public API inputs are bounded, browser access is restricted to the exact configured web origin, and process-local per-IP throttling applies stricter limits to expensive routes.
- `GET /api/health` remains a database-independent process liveness check. `GET /api/health/ready` executes `SELECT 1` through the existing database service and returns HTTP 503 when PostgreSQL is unavailable.
- Production migrations are forward-only and separate from API startup. The production smoke command checks Vercel rendering, Render health, species search, observation synchronization, and a PostGIS bbox read.
- `README.md` describes the current V1 and local/deployment workflows, `ARCHITECTURE.md` records implemented boundaries and trade-offs, and `RUNBOOK.md` covers production diagnosis, log correlation, rollback, and forward fixes.

## Persistence snapshot

- TypeScript migrations in `api/migrations` version the schema and install PostGIS in the dedicated `extensions` schema.
- `species` stores application identities. `species_provider_mappings` stores provider identities and compact resolution audit context without treating scientific names as unique.
- `observations` stores normalized dates, optional timestamps, optional public WGS84 points, privacy/accuracy information, provider links, license data, dataset/publisher provenance, and auditable deduplication keys.
- Provider records remain separate rows. Exact canonical identities group known copies, and shared SQL selects one stable representative for spatial and temporal reads.
- Observation-page synchronization tables preserve page membership, provider totals, freshness, and successful-sync time independently of observation update timestamps.
- B-tree indexes support identity/species lookup and a GiST index supports public-location viewport queries. Missing or restricted public coordinates remain `NULL` and are never reconstructed.

## Important current decisions

- Project content and UI use English. The application remains Poland-focused and preserves proper names, scientific names, and provider data.
- The architecture is Next.js → Nature Lens API → provider adapters and PostgreSQL/PostGIS. The frontend never depends on raw provider payloads.
- The backend remains a modular monolith. Controllers are thin, provider contracts stay at integration boundaries, and explicit `pg`/PostGIS persistence is preferred over a generic ORM or repository abstraction.
- iNaturalist supplies species search and observations; GBIF supplies taxon matching and observations; Nominatim supplies place search/lookup; Open-Meteo supplies current model conditions; GDOŚ supplies display-only protected-area geometry.
- Exact, high-confidence GBIF taxon matches can map to an application species. Name similarity alone never merges species.
- Cross-provider observation grouping requires exact canonical evidence. Similar dates or coordinates are never used, and iNaturalist remains the representative of a linked iNaturalist/GBIF group.
- Bbox and seasonality reads cover only `locally-synchronized` data and must not be presented as complete provider coverage or proof of species presence within a named boundary.
- Observation pages use database-backed freshness and stale-if-error behavior. Weather and Nominatim use bounded process-local caches. Single-flight registries, Nominatim throttling, and incoming API throttling are also process-local.
- Public Nominatim is used only for low-traffic, submit-based search through one process-wide request per second. Scaling the API horizontally requires a different provider or coordination strategy first.
- GDOŚ geometry is simplified only for map presentation and is not authoritative for legal or analytical decisions.
- Provider availability metadata describes one synchronization request, not global provider health.
- Every API request gets a server-generated request ID used in structured JSON logs and returned as `X-Request-ID`. There is no distributed trace propagation.
- Redis, queues, background synchronization, microservices, GraphQL, and advanced GIS infrastructure remain excluded until a concrete requirement justifies them.
- Production schema changes use forward migrations. Application rollback and database forward fixes are separate recovery strategies.
- Docker uses process-only liveness, while the intended UptimeRobot target is database readiness every five minutes. Readiness intentionally does not validate migrations, domain tables, PostGIS, or external providers.

## Known limitations / blockers

- Map totals, species summaries, and seasonality include only observations already synchronized into PostgreSQL.
- Cross-provider grouping currently recognizes only the official GBIF-published iNaturalist relationship.
- Places are provider-derived and not persisted independently.
- Process-local caches, rate limits, queues, and single-flight registries assume the current single-process API deployment.
- Exact-origin CORS allows the production Vercel origin. Preview deployments can server-render against production but cannot perform browser map refreshes without a deliberate policy change.
- GDOŚ results may be truncated and use display-simplified geometry.
- Request IDs correlate one API request only; V1 has no external log aggregation, global provider-health monitor, or distributed tracing.
- A successful smoke run may use a fresh observation cache or stale-if-error fallback and therefore does not prove that a biodiversity provider was contacted during that run.
- Integration tests require a Docker-compatible runtime and may download the PostGIS image on first use.
- Node.js 23.3.0 cannot load a Nest CLI dependency. Use Node.js 22.22.3+ on the 22.x line or 24.15+ on the 24.x line.

## Development commands

Run from the repository root with pnpm 12.4.1 and a supported Node.js version:

```bash
pnpm install
cp web/.env.example web/.env.local
cp api/.env.example api/.env
pnpm db:migrate

pnpm dev:api
pnpm dev:web

pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm build
pnpm smoke:production
```

Production migrations require `MIGRATION_DATABASE_URL` in the process environment:

```bash
pnpm db:migrate:production
```

See `README.md` for setup and deployment, `ARCHITECTURE.md` for system decisions, and `RUNBOOK.md` for operational diagnosis.

## Verification snapshot

- All 315 API unit tests pass, including HTTP coverage for database-independent liveness plus readiness success and failure.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, and `git diff --check` pass after the readiness change.
- The production Vercel application, Render API, and Supabase/PostGIS flow passed `pnpm smoke:production` after step 63.
- The latest full quality evidence before this documentation-only step includes passing format, lint, type-check, unit, integration, E2E, and production build checks recorded during phases 9 and 10.
- `pnpm format:check` and `git diff --check` passed after step 64.
- Step 64 local document links resolve, documented commands match the root scripts, and obsolete hosting or maturity references have been removed.
