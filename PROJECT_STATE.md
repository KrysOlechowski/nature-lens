# 📍 Project State

> **Project:** Nature Lens
>
> **Status:** The production API is live on Render and responds on `/api/health`
>
> **Current phase:** Phase 10 · Production deployment
>
> **Last completed step:** 60 · Add production migration command
>
> **Current step:** 61 · Add production API configuration
>
> **Next step:** 🔵 Manual setup · Vercel web project

## What currently works

- The pnpm workspace contains the Next.js 16 `web` application and NestJS 12 `api` application, with shared root commands for formatting, linting, typechecking, testing, and building.
- The NestJS API has a reproducible multi-stage production image built from the workspace root, with production-only runtime dependencies, a non-root process, runtime-only configuration, and a Docker health check against `/api/health`.
- The production API image is deployed on Render, connects to the production Supabase session pooler over SSL, and exposes a public `/api/health` endpoint that returns the expected versioned response.
- A forward-only production migration command prepares an empty database from repository migrations before API deployment, using a migration-only connection secret, one transaction, order checks, and an advisory lock.
- GitHub Actions runs one fail-fast `Quality` job for pull requests and pushes to `main`, covering frozen dependency installation, formatting, linting, typechecking, unit tests, Testcontainers integration tests, deterministic Playwright E2E, and both application builds.
- Playwright drives the real Next.js application through the primary species-search and place-search journeys against a deterministic public Nature Lens API fixture, including locally served MapLibre style data and explicit failure for unsupported fixture requests.
- Global search stores its trimmed query in the URL, calls the Nature Lens API only for nonempty queries, and concurrently searches species and places through independently validated public contracts.
- Species and place result groups preserve partial success: an unavailable source does not hide the other group, and successful empty results remain distinct from provider failures.
- Place results open server-rendered `/places/[id]/[slug]` pages that resolve opaque IDs through the API, distinguish missing places from provider failures, and show an interactive map fitted to the provider bbox or centered on the provider point.
- Place maps query locally synchronized observations for their actual MapLibre viewport, cluster the returned subset, show exact full-bbox observation and species totals, and list species using full-bbox counts independently of the feature limit.
- Place observation refreshes are debounced and cancel superseded requests. Initial and refresh failures remain inside the biodiversity section, while failed refreshes preserve the last successful map, totals, and species list.
- Place pages independently stream current Open-Meteo model conditions for the place center. Weather loading and failures remain inside that section and do not block the place header, map, or biodiversity observations.
- Place maps provide an independently toggleable GDOŚ protected-areas layer for the current viewport, with safe popups, attribution, a legal-accuracy disclaimer, bounded results, explicit truncation, and isolated loading, retry, and stale-data states.
- The protected-areas API validates official WFS GeoJSON, normalizes supported Polygon and MultiPolygon conservation layers, and returns viewport-dependent display simplifications that are structurally revalidated before exposure.
- Search results use stable application-owned species IDs and link to server-rendered `/species/[id]` pages with distinct not-found and temporary-failure behavior.
- Species detail pages render persisted names and taxonomy before independently streaming the observation section through a section-level Suspense boundary.
- Initial observation failures remain inside the map section and provide retry; viewport loading, failed refreshes, successful empty results, and truncated results have distinct UI states.
- The MapLibre map is fitted to Poland, clusters observations, expands clusters, renders validated details in safe DOM popups, and preserves privacy and precision notices.
- At zoom 7 or closer, map movement requests a debounced, bounded viewport query. Newer movements abort and invalidate older requests, and failed refreshes preserve the last successfully loaded data.
- The API exposes health, species search, application-owned species details, paginated observation synchronization, and bounded observation GeoJSON endpoints.
- The API exposes validated place search through a thin provider-neutral controller and service backed by the existing Nominatim adapter.
- The API exposes provider-neutral place lookup by opaque ID. Nominatim lookup results are runtime-validated, matched to the requested OSM identity, and accepted only with explicit Polish country evidence.
- The API exposes provider-neutral current weather by WGS84 coordinates. Open-Meteo responses and units are runtime-validated before temperature, precipitation, wind speed, and a UTC validity time enter application logic.
- The API exposes a provider-neutral `GET /api/observations` viewport query across all locally synchronized species, with independent bounded limits for map features and the ranked species list.
- The API validates server-only configuration, creates one shared PostgreSQL pool, verifies the database connection before startup, and closes the pool during application shutdown.
- Browser map requests use credential-free `GET` calls allowed only from the exact configured `WEB_ORIGIN`.
- Public API routes use process-local per-IP throttling with a validated baseline policy and stricter overrides for provider-backed searches, lookups, weather, protected areas, observation synchronization, and bbox reads. Search length, pagination windows, page sizes, result limits, and bbox spans are bounded before application work begins.
- Every API request receives a server-generated UUID returned as `X-Request-ID`. A shared `AsyncLocalStorage` context adds it to JSON logs across asynchronous controller, service, and provider work, while response completion is logged once with the method, query-free path, final status, and latency.
- A provider-neutral backend HTTP client provides JSON `GET`, per-provider per-attempt timeouts, bounded retry with jitter, attempt-aware logging, and categorized transport failures.
- The iNaturalist adapter searches active species and retrieves explicit observation pages restricted to Poland. Responses are runtime-validated before being mapped into small integration types.
- The GBIF adapter retrieves paginated occurrence records restricted to Poland, validates only the provider fields required by the application, and maps them into the existing provider-independent observation shape.
- Species observation synchronization also fetches GBIF pages when the species has a resolved GBIF mapping; a controlled GBIF provider failure does not remove the available iNaturalist result.
- Observation synchronization responses expose request-scoped data availability for each participating provider as `available`, `stale`, or `unavailable`. Species pages keep rendering usable observations and show a non-blocking warning for stale or unavailable provider data.
- Biodiversity provider contracts are split by species-search, taxon-match, and observation capabilities. iNaturalist implements search and observations, while GBIF implements matching and observations.
- GBIF also exposes a taxon-match capability pinned to the legacy GBIF Backbone checklist used explicitly by its occurrence adapter.
- Species identity resolution links exact, high-confidence GBIF Backbone matches to iNaturalist taxa, resolves synonyms to accepted GBIF usages, and leaves uncertain matches separate.
- Observation providers accept one Nature Lens page-based pagination contract and translate it into provider-specific parameters such as `page`/`per_page` or `limit`/`offset`.
- `SpeciesService` returns provider-independent Nature Lens species and observation models, preserving source provenance, temporal precision, public coordinate accuracy, and provider privacy restrictions.
- Observation provenance retains the provider record link, independently available license code and URL, and optional dataset identity, title, link, publisher name, and publisher organization ID through normalization, persistence, paginated responses, and GeoJSON responses.
- GBIF records are linked to an iNaturalist observation only when they belong to the official iNaturalist GBIF dataset and contain the exact canonical iNaturalist observation URL. Similar dates or coordinates are never used for automatic deduplication.
- Spatial observation results contain one feature per deduplicated group and retain every grouped source link. Map popups list all sources, and cluster counts operate on grouped features.
- Species pages show locally synchronized observation counts across all 12 calendar months and by year, with undated groups reported separately and limitations explained.
- The seasonality endpoint aggregates deduplicated observation groups in PostgreSQL, includes groups without public coordinates, and validates its complete response before frontend rendering.
- The backend and frontend define the same provider-neutral Place contract with an opaque ID, display-only slug, required WGS84 center, nullable provider-supplied bounding box, and a compact application-owned place type.
- The OpenStreetMap Nominatim adapter searches only Poland, validates provider responses at runtime, maps stable OSM objects into the Place contract, and returns center and reliable non-node bounding boxes such as the extent for Puszcza Niepołomicka.
- Nominatim searches use an application-specific User-Agent, a bounded ten-minute cache checked before rate limiting, identical in-flight request coalescing, and one process-wide provider request per second.
- Provider failures are translated into a provider-neutral taxonomy and stable API errors without leaking transport details, validation errors, or provider payloads.
- Species and normalized observations are persisted in PostgreSQL/PostGIS. Exact observation pages use a database-backed read-through cache with configurable freshness and stale-if-error behavior, while concurrent misses and stale refreshes for the same provider page share the complete synchronization operation.
- Local observations can be queried by a WGS84 bounding box and returned as a bounded GeoJSON `FeatureCollection<Point>` with explicit local-dataset and truncation metadata.
- Unit tests cover transport, provider validation and mapping, normalization, application services, controllers, persistence behavior, and provider-error translation. Focused mapper cases protect private iNaturalist locations, invalid provider dates, and exact-identity-only cross-provider deduplication. Integration tests exercise repository migrations and PostgreSQL/PostGIS behavior in an ephemeral container, including the HTTP-level species search, multi-provider observation synchronization, species bbox, and all-species bbox flow with only external providers stubbed.

## Persistence snapshot

- Database schema is versioned with `node-pg-migrate` TypeScript migrations in `api/migrations`; local migrations load `DATABASE_URL` from `api/.env`, while production migrations require an explicitly injected `MIGRATION_DATABASE_URL` and run before API deployment.
- The production Supabase project is configured separately from development, with its unused Data API disabled and incoming database connections requiring SSL.
- Local development uses the Supabase Session pooler for IPv4 compatibility. Its connection string remains in the ignored `api/.env` file.
- PostGIS is installed in the dedicated `extensions` schema, and spatial functions and operators are schema-qualified.
- `species` stores application-owned identities without treating a scientific name as unique. `species_provider_mappings` keeps provider-specific external IDs and compact identity-resolution audit context outside the core species model.
- `observations` stores normalized dates, optional timestamps, optional WGS84 `geometry(Point, 4326)` locations, public accuracy and privacy information, provider record links, license details, and optional dataset and publisher provenance.
- Each observation stores an auditable deduplication key and resolution method. Provider records remain separate rows, with an index supporting species-scoped grouping.
- Observation-page synchronization tables preserve exact page membership, ordering, provider totals, and freshness independently of observation record timestamps.
- Provider-scoped observation identifiers are unique. Species lookups use a B-tree index, and public-location viewport queries use a GiST index.
- Missing public coordinates remain `NULL`; coordinates are never reconstructed from restricted or non-public provider data.

## Important current decisions

- English is used for project content and UI. The product remains focused on Poland and preserves provider names, scientific names, and source data.
- The target architecture remains Next.js → Nature Lens API → provider adapters and PostgreSQL/PostGIS in a modular monolith.
- The frontend depends on public Nature Lens DTOs, never raw provider payloads.
- External JSON enters the application as `unknown`, is runtime-validated at the provider boundary, and is reduced to only the fields required by current product behavior.
- Provider adapters own endpoint details, query parameters, provider-specific validation, transport translation, and mapping into small integration types.
- Open-Meteo `current` values are treated as model conditions rather than physical station measurements. Their Unix validity time is normalized by the backend to an unambiguous UTC `validAt` value.
- Current weather uses a bounded 100-entry in-memory cache with a five-minute default freshness window configured by `WEATHER_FRESHNESS_WINDOW_SECONDS`. Concurrent misses for the same coordinates share one provider request; expired entries are refreshed normally, and provider failures are not hidden behind stale weather.
- GDOŚ protected areas are fetched live from the official WFS only while the map layer is enabled. One combined bbox request covers the supported surface layers and asks for 201 features so the API can return at most 200 with exact `truncated` semantics.
- Protected-area geometry is simplified only for map presentation after provider validation and normalization. Tolerance follows the viewport span with fixed minimum and maximum bounds; identity and properties do not depend on geometry, no protected-area data is persisted, and `geometryPurpose: "display-simplified"` remains distinct from feature truncation.
- Provider DI tokens are capability- and provider-specific. `SpeciesService` depends on observation capabilities rather than concrete adapters and synchronizes mapped iNaturalist and GBIF pages without moving provider logic into the application layer.
- GBIF occurrence `key` is stored as the provider-scoped external observation ID. It supports idempotency for the same GBIF record but is not treated as semantic occurrence identity or as a permanent cross-publication identifier.
- License codes and URLs are independent optional representations. Nature Lens preserves only values supplied by a provider and does not invent a missing equivalent.
- GBIF occurrence responses provide dataset and publisher identifiers without an additional Registry request. A stable GBIF dataset link is derived from `datasetKey`; unavailable titles or publisher names remain `null`.
- Observation upserts enrich missing provenance without replacing stored optional values with a later `null`. A changed dataset identifier starts a new metadata group so fields from different datasets are never combined.
- GBIF exposes public occurrence coordinates without an iNaturalist-equivalent privacy contract. Their privacy remains `unknown`; missing coordinates never imply obscurity, and date-times without an explicit offset or a valid calendar date never receive an invented timestamp.
- Application services and normalized models remain provider-independent while retaining provider name, external ID, and source URL.
- Species use internal `bigint` identities represented as strings in public JSON. Provider mappings are written transactionally and cannot be silently reassigned to another species.
- Species upserts are keyed by provider mapping rather than scientific name. Name normalization is only one comparison signal and never merges taxa by itself.
- Automatic GBIF identity matches require an exact match, confidence of at least 95, compatible taxon ranks, and the normalized queried name matching the returned usage. Synonyms store the accepted usage key while audit context retains both matched and accepted keys.
- GBIF taxon matching and occurrence queries explicitly use legacy Backbone checklist `d7dddbf4-2cf0-4f39-9b2a-bb099caae36c`; switching taxonomic keyspaces requires a deliberate migration.
- Provider mapping writes use deterministic transaction-scoped advisory locks so concurrent identity resolution cannot create duplicate application species or reassign an existing mapping.
- PostgreSQL access uses the low-level `pg` driver so persistence and PostGIS queries remain explicit; no generic repository abstraction or ORM is introduced.
- Observation storage identity remains provider-scoped. Cross-provider grouping uses only exact canonical identities: direct iNaturalist records use `inaturalist:{id}`, and a GBIF record may share that key only for dataset `50c9509d-22c7-4a22-a47d-8c48425ef4a7` with an exact `https://www.inaturalist.org/observations/{id}` `occurrenceID`.
- iNaturalist is always the representative of a linked iNaturalist/GBIF group. The representative is chosen before spatial filtering, so a group has no public map point when its iNaturalist record has none, even if the GBIF copy contains coordinates.
- Bounding-box limits and truncation metadata count deduplicated groups rather than raw provider records; MapLibre consequently clusters one feature per group.
- Location availability, privacy, and precision are separate concepts. Missing coordinates do not imply obscurity, explicitly private iNaturalist locations expose no domain coordinates, and restricted locations never fall back to more precise non-public accuracy.
- Observation dates and timestamps remain independent so date-only provider data does not receive invented temporal precision.
- Species-scoped spatial reads, all-species viewport reads, and seasonality use the same SQL definition for selecting a deduplicated representative: iNaturalist first, then stable observation ID. Representatives are selected before spatial filtering, so another provider's coordinates never pull an otherwise non-public or out-of-bounds representative into a result.
- The general observations endpoint is independent of place identity and provider extents. Its bbox always comes from the current map viewport; `limit` applies only to GeoJSON features, while exact observation totals and species aggregation are calculated over the full bbox before independent response limits.
- Seasonality uses only the representative's provider-supplied `observed_on` value. It never derives a calendar bucket from `observed_at`; groups without `observed_on` contribute to `undatedCount`.
- Seasonality describes only locally synchronized records. Its distribution can reflect incomplete provider coverage and uneven observation effort, and must not be presented as proof of continuous species presence.
- Place identity is an opaque deterministic value derived only from a provider namespace and its stable object identity. Labels and slugs never participate in identity, consumers must not parse or construct IDs, and replacing a provider may change place IDs until places are persisted independently.
- Place detail URLs use `/places/[id]/[slug]`: the opaque `id` is the only identity, while `slug` is display-only and must not participate in lookup or equality.
- Nominatim place IDs use one integration-owned codec for both encoding search results and decoding lookup requests. Frontend and application consumers continue to treat the value as opaque.
- Nominatim search and place lookup share the same process-wide one-request-per-second queue. Search results seed the bounded ID cache, while direct lookups cache both found and missing results.
- Nominatim-backed place identity uses the `osm` namespace plus `osm_type` and `osm_id`; provider classification and unstable Nominatim `place_id` never participate. Results without a stable OSM object identity are omitted.
- Every place has a provider-supplied WGS84 center. A bounding box is preserved only when the provider supplies a reliable extent; otherwise it remains `null` and is never synthesized around the center.
- Nominatim node bounding boxes are treated as provider-guessed display hints and are not exposed. Way and relation bounding boxes are preserved as provider extents.
- Place types are application-owned categories rather than raw provider classifications. The initial set is city, town, village, administrative area, natural area, and other.
- The public Nominatim endpoint is suitable only for low-traffic, submit-based MVP search: autocomplete is forbidden, aggregate traffic is capped at one request per second, availability has no SLA, and meaningful production scale requires another OSM-backed service or a self-hosted instance. Place-search UI must visibly attribute OpenStreetMap contributors.
- WGS84 points use longitude-first coordinate order. Spatial reads support species-scoped and all-species bounding boxes, include boundaries, use deterministic recency ordering, and return at most 1,000 features.
- Bounding-box reads never contact providers. Their `locally-synchronized` dataset scope must not be presented as complete provider coverage.
- Observation page synchronization atomically upserts normalized observations and replaces exact-page membership. Fresh pages avoid the provider; stale pages may fall back to persisted data after a controlled provider failure. Single-flight keys include species ID, provider, page, and page size, and remain active through provider fetch, transactional persistence, page metadata replacement, and the final read.
- Provider status describes only data availability during the current observation synchronization use case, not global provider health. A fresh cache hit is `available` without implying that the provider was contacted; a failed refresh with usable persisted data is `stale`; a controlled failure without usable fallback is `unavailable`; and GBIF is omitted when no confident mapping exists.
- Provider availability remains separate from page freshness/source, local dataset scope, and response truncation. It is response metadata and is never copied onto observation records.
- The observation freshness window defaults to one hour and is configurable with `OBSERVATION_FRESHNESS_WINDOW_SECONDS`.
- Incoming throttling uses one `@nestjs/throttler` policy with a 60-second window, a default limit of 120 requests, and an expensive-route override of 30 requests. The three values are validated environment configuration; throttler-provided `429` responses, headers, `req.ip` tracking, and IPv6 grouping are preserved without trusting forwarded headers or coupling API limits to provider limits.
- Nest's built-in `ConsoleLogger` emits compact JSON and flattens structured metadata into top-level fields. One module-level `AsyncLocalStorage` singleton supplies request context without leaking ALS mechanics into domain services; bootstrap and other non-request logs remain valid without a `requestId`.
- Request IDs are generated by the API for every request. Inbound `X-Request-ID` values are deliberately ignored until a trusted propagation policy exists, and provider transport logs expose only provider names, query-free endpoint paths, attempts, statuses, latency, and stable error categories rather than URLs, payloads, or headers.
- Public search queries are limited to 100 trimmed characters. Observation pagination must remain inside a 100,000-record result window, and bbox requests are limited to 20 degrees of longitude and 15 degrees of latitude while retaining the full-Poland viewport.
- External HTTP still supports only the idempotent JSON `GET` behavior required by implemented providers. iNaturalist, GBIF, Open-Meteo, and GDOŚ use at most two attempts for network errors, timeouts, and HTTP 502/503/504; Nominatim always uses one attempt, and 4xx responses including 429, HTTP 500, invalid JSON, and contract-validation failures are not retried.
- Provider timeouts are validated, configurable per attempt, and default to 10 seconds for iNaturalist, GBIF, and Nominatim, 5 seconds for Open-Meteo, and 15 seconds for GDOŚ. With the current 250 ms maximum first backoff, the approximate maximum operation budgets are respectively 20.25, 20.25, 10, 10.25, and 30.25 seconds.
- MapLibre remains isolated in a Client Component. Provider data is flattened to safe scalar properties, rendered features are validated again, and popup content is built with DOM APIs rather than HTML interpolation.
- Initial observation retry uses `router.refresh()` from a small Client Component. Viewport retry remains local to the map and preserves the last successful dataset.
- Place mapping uses a dedicated Client Component rather than extending the species map. Reliable provider extents set the initial view with `fitBounds`; places without one use their representative center and a bounded fallback zoom, while observation selection always follows the actual viewport.
- Place weather is a separate server-rendered section with its own Suspense boundary and unavailable state. It represents the provider model cell for the place center, not conditions across the full place extent.
- `NEXT_PUBLIC_API_BASE_URL` is public build-time configuration and must not contain secrets. The optional map style URL defaults to OpenFreeMap Liberty.
- Browser E2E tests stop at the public Nature Lens API boundary: they run the real Next.js application while a small HTTP fixture supplies only the contracts required by the two primary journeys. Backend HTTP, PostgreSQL, and PostGIS behavior remains the responsibility of the integration suite.
- E2E MapLibre initialization uses an empty local style, so browser-test success never depends on public map styles or tiles. E2E uses `.next-e2e` to avoid interfering with a concurrently running development server.
- CI uses Node.js 22.22.3 and reads pnpm 12.4.1 from the root `packageManager` field. `actions/setup-node` caches only the pnpm store with `pnpm-lock.yaml` as the dependency key; build output, Playwright browsers, Testcontainers images, and `node_modules` are not cached.
- The CI job supplies only non-secret local build configuration. Integration tests own their ephemeral PostGIS container and migrations, while E2E owns the local Next.js and fixture API processes.
- The production API image uses the same pinned Node.js 22.22.3 and pnpm 12.4.1 toolchain as the repository. Build dependencies remain in intermediate stages; the runtime image contains only the compiled API and production dependencies on Debian Bookworm slim.
- Production container configuration is supplied only at runtime. The API runs directly as PID 1 under the image's non-root `node` user, listens on the runtime `PORT`, and uses `/api/health` for a Node-based Docker health check without adding a separate HTTP client.
- Production migrations are forward-only and separate from API startup. They use a direct PostgreSQL connection where IPv6 is available, may use the IPv4 session pooler otherwise, and fail immediately when another migration process holds the advisory lock.
- No microservices, Redis, queues, GraphQL, background synchronization, or advanced GIS infrastructure are introduced without a concrete requirement.

## Known limitations / blockers

- Persistence integration tests require a running Docker-compatible container runtime and may need to download the PostGIS image.
- Production API behavior beyond the health endpoint still requires step 61 verification and configuration, and the production web deployment is not configured yet.
- Observation and weather single-flight registries are process-local. Multiple API replicas could each refresh the same key concurrently; distributed coordination is not justified for the current single-process MVP.
- Cross-provider grouping currently recognizes only the official GBIF-published iNaturalist dataset. Other provider relationships remain separate unless a future step adds another equally strong identity rule.
- Paginated synchronization remains provider-page based. The public paginated response continues to describe the primary iNaturalist page, while the spatial read combines locally synchronized provider records.
- Observations persisted before step 40 have nullable license and dataset provenance until a later provider synchronization supplies it.
- Bounding-box GeoJSON, exact bbox totals, and bbox species summaries contain only observations already synchronized into PostgreSQL and are not complete provider coverage.
- Seasonality contains only observations already synchronized into PostgreSQL and is not complete provider coverage.
- Places are not yet persisted; global search results and their opaque provider-derived IDs come directly from the current adapter.
- The Nominatim cache and rate limiter are process-local. This satisfies the current single-process MVP, but multiple API replicas would not provide an aggregate cross-process one-request-per-second limit and must not share the public endpoint without a different coordination or provider strategy.
- Incoming API throttling storage is process-local. Multiple API replicas would require shared throttler storage for aggregate limits, and any future reverse-proxy deployment must configure `trust proxy` deliberately before forwarded client addresses can be used safely.
- Request IDs currently correlate work only within one API request. There is no trusted inbound ID propagation, distributed trace context, external log aggregation, or cross-service tracing.
- The Open-Meteo freshness cache is process-local and resets on restart. Multiple API replicas would cache independently.
- GDOŚ protected-area boundaries are display-only, may be incomplete when `truncated` is true, and are not suitable for legal or spatial-analysis decisions. Turf simplification reduces transfer size but does not promise topology-preserving generalization.
- Node.js 23.3.0 cannot load a Nest CLI dependency. Use Node.js 22.22.3+ on the 22.x line or 24.15+ on the 24.x line for the complete toolchain.
- The agent environment blocks local ports required by development servers and Turbopack CSS processing. The default frontend build must be verified in an unrestricted local environment.

## Development commands

Run from the repository root with pnpm 12.4.1 and a compatible Node.js version:

```bash
pnpm install
cp web/.env.example web/.env.local
cp api/.env.example api/.env

pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm build

pnpm db:migrate
pnpm db:migrate:production # requires MIGRATION_DATABASE_URL in the process environment
pnpm db:migrate:create migration-name
pnpm db:migrate:down

pnpm dev:web
pnpm dev:api
pnpm --filter web start
pnpm --filter api start

docker build -f api/Dockerfile -t nature-lens-api .
docker run --rm --env-file api/.env -p 3001:3001 nature-lens-api
```

Install the Playwright Chromium runtime once with `pnpm --filter web exec playwright install chromium`. Run development servers in separate terminals. The frontend defaults to http://localhost:3000 and the API to http://localhost:3001. Build an application before starting its production server.

## Verification

- The step 60 production command applied all 10 repository migrations to an empty PostgreSQL/PostGIS database, placed PostGIS in the `extensions` schema, created all expected application tables, and completed a second run with no pending migrations.
- The step 60 production command failed before connecting when `MIGRATION_DATABASE_URL` was absent, confirming that it does not fall back to local `api/.env` configuration.
- Focused Prettier validation passed for the step 60 package scripts and migration documentation.
- The CI workflow passed YAML parsing and focused Prettier validation after step 58; its first hosted GitHub Actions execution awaits the next push or pull request.
- The step 59 production API image built successfully from scratch with `--no-cache`, the frozen workspace lockfile, Node.js 22.22.3, and pnpm 12.4.1.
- The step 59 container started from runtime-provided environment configuration, connected to PostgreSQL, returned `200` from `/api/health`, reached Docker health status `healthy`, and stopped gracefully with exit code 0.
- The step 59 runtime inspection confirmed PID 1 is the Node API process running as UID 1000, `NODE_ENV=production` is set, and `/app` contains only `dist`, `node_modules`, and `package.json`. Local environment files, TypeScript sources, tests, migrations, build tools, and development dependencies are absent.
- `pnpm format:check`: passed after step 59.
- `pnpm lint`: passed after step 58.
- `pnpm typecheck`: passed after step 58.
- `pnpm test:e2e`: passed both primary browser journeys after step 57 using Chromium, the real Next.js application, the deterministic API fixture, and the local map style.
- `pnpm test`: passed all 312 API and 8 frontend unit tests after step 58.
- `pnpm test:integration`: passed all 16 API integration tests after step 56 against ephemeral migrated PostgreSQL/PostGIS databases.
- The step 58 integration recheck could not start because the agent session had no available container runtime; the GitHub-hosted runner provides Docker for the unchanged Testcontainers suite.
- The step 58 E2E recheck could not bind its local fixture port in the agent sandbox; the same unchanged two-test suite passed after step 57.
- The API production build passed after step 58.
- The default frontend build reaches MapLibre CSS processing but cannot complete in the agent sandbox because Turbopack is denied permission to bind its required local port.
- A policy-compliant live Nominatim smoke request returned Puszcza Niepołomicka as OSM relation `61493` with a center and provider bounding box.
- A live Open-Meteo smoke request for Warsaw returned the expected Unix validity time and metric current-condition units used by the adapter contract.
- A live GDOŚ WFS request for Warsaw returned valid Polygon and MultiPolygon features across five requested layer categories. Presentation simplification reduced the sample from 124,050 to 18,807 positions and from about 4.8 MB to 0.73 MB without removing any of its ten features.
- `git diff --check`: passed after step 59.
- Step 59 Definition of Done is satisfied: the API runs locally from the production image and passes the configured health check.
