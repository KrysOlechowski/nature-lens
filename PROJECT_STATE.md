# 📍 Project State

> **Project:** Nature Lens
>
> **Status:** Global search returns independently available species and Polish place results
>
> **Current phase:** Phase 7 · Place page and progressive multi-source UI
>
> **Last completed step:** 45 · Extend global search with places
>
> **Current step:** 46 · Add place detail page with map extent
>
> **Next step:** 47 · Show biodiversity observations inside a place

## What currently works

- The pnpm workspace contains the Next.js 16 `web` application and NestJS 12 `api` application, with shared root commands for formatting, linting, typechecking, testing, and building.
- Global search stores its trimmed query in the URL, calls the Nature Lens API only for nonempty queries, and concurrently searches species and places through independently validated public contracts.
- Species and place result groups preserve partial success: an unavailable source does not hide the other group, and successful empty results remain distinct from provider failures.
- Place results link to the future `/places/[id]/[slug]` detail route and visibly attribute OpenStreetMap contributors.
- Search results use stable application-owned species IDs and link to server-rendered `/species/[id]` pages with distinct not-found and temporary-failure behavior.
- Species detail pages render persisted names and taxonomy before independently streaming the observation section through a section-level Suspense boundary.
- Initial observation failures remain inside the map section and provide retry; viewport loading, failed refreshes, successful empty results, and truncated results have distinct UI states.
- The MapLibre map is fitted to Poland, clusters observations, expands clusters, renders validated details in safe DOM popups, and preserves privacy and precision notices.
- At zoom 7 or closer, map movement requests a debounced, bounded viewport query. Newer movements abort and invalidate older requests, and failed refreshes preserve the last successfully loaded data.
- The API exposes health, species search, application-owned species details, paginated observation synchronization, and bounded observation GeoJSON endpoints.
- The API exposes validated place search through a thin provider-neutral controller and service backed by the existing Nominatim adapter.
- The API validates server-only configuration, creates one shared PostgreSQL pool, verifies the database connection before startup, and closes the pool during application shutdown.
- Browser map requests use credential-free `GET` calls allowed only from the exact configured `WEB_ORIGIN`.
- A controlled backend HTTP client provides JSON `GET`, configurable timeouts, provider-aware logging, and categorized transport failures.
- The iNaturalist adapter searches active species and retrieves explicit observation pages restricted to Poland. Responses are runtime-validated before being mapped into small integration types.
- The GBIF adapter retrieves paginated occurrence records restricted to Poland, validates only the provider fields required by the application, and maps them into the existing provider-independent observation shape.
- Species observation synchronization also fetches GBIF pages when the species has a resolved GBIF mapping; a controlled GBIF provider failure does not remove the available iNaturalist result.
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
- Species and normalized observations are persisted in PostgreSQL/PostGIS. Exact observation pages use a database-backed read-through cache with configurable freshness and stale-if-error behavior.
- Local observations can be queried by a WGS84 bounding box and returned as a bounded GeoJSON `FeatureCollection<Point>` with explicit local-dataset and truncation metadata.
- Unit tests cover transport, provider validation and mapping, normalization, application services, controllers, persistence behavior, and provider-error translation. Integration tests exercise repository migrations and PostgreSQL/PostGIS behavior in an ephemeral container.

## Persistence snapshot

- Database schema is versioned with `node-pg-migrate` TypeScript migrations in `api/migrations`; migrations run explicitly rather than during API startup.
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
- Provider DI tokens are capability- and provider-specific. `SpeciesService` depends on observation capabilities rather than concrete adapters and synchronizes mapped iNaturalist and GBIF pages without moving provider logic into the application layer.
- GBIF occurrence `key` is stored as the provider-scoped external observation ID. It supports idempotency for the same GBIF record but is not treated as semantic occurrence identity or as a permanent cross-publication identifier.
- License codes and URLs are independent optional representations. Nature Lens preserves only values supplied by a provider and does not invent a missing equivalent.
- GBIF occurrence responses provide dataset and publisher identifiers without an additional Registry request. A stable GBIF dataset link is derived from `datasetKey`; unavailable titles or publisher names remain `null`.
- Observation upserts enrich missing provenance without replacing stored optional values with a later `null`. A changed dataset identifier starts a new metadata group so fields from different datasets are never combined.
- GBIF exposes public occurrence coordinates without an iNaturalist-equivalent privacy contract. Their privacy remains `unknown`; missing coordinates never imply obscurity, and date-times without an explicit offset never receive an invented timezone.
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
- Location availability, privacy, and precision are separate concepts. Missing coordinates do not imply obscurity, and restricted locations never fall back to more precise non-public accuracy.
- Observation dates and timestamps remain independent so date-only provider data does not receive invented temporal precision.
- Spatial reads and seasonality share one SQL definition for selecting a deduplicated group representative: iNaturalist first, then stable observation ID.
- Seasonality uses only the representative's provider-supplied `observed_on` value. It never derives a calendar bucket from `observed_at`; groups without `observed_on` contribute to `undatedCount`.
- Seasonality describes only locally synchronized records. Its distribution can reflect incomplete provider coverage and uneven observation effort, and must not be presented as proof of continuous species presence.
- Place identity is an opaque deterministic value derived only from a provider namespace and its stable object identity. Labels and slugs never participate in identity, consumers must not parse or construct IDs, and replacing a provider may change place IDs until places are persisted independently.
- Place detail URLs use `/places/[id]/[slug]`: the opaque `id` is the only identity, while `slug` is display-only and must not participate in lookup or equality.
- Nominatim-backed place identity uses the `osm` namespace plus `osm_type` and `osm_id`; provider classification and unstable Nominatim `place_id` never participate. Results without a stable OSM object identity are omitted.
- Every place has a provider-supplied WGS84 center. A bounding box is preserved only when the provider supplies a reliable extent; otherwise it remains `null` and is never synthesized around the center.
- Nominatim node bounding boxes are treated as provider-guessed display hints and are not exposed. Way and relation bounding boxes are preserved as provider extents.
- Place types are application-owned categories rather than raw provider classifications. The initial set is city, town, village, administrative area, natural area, and other.
- The public Nominatim endpoint is suitable only for low-traffic, submit-based MVP search: autocomplete is forbidden, aggregate traffic is capped at one request per second, availability has no SLA, and meaningful production scale requires another OSM-backed service or a self-hosted instance. Place-search UI must visibly attribute OpenStreetMap contributors.
- WGS84 points use longitude-first coordinate order. Spatial reads are species-scoped, include bounding-box boundaries, use deterministic recency ordering, and return at most 1,000 records.
- Bounding-box reads never contact providers. Their `locally-synchronized` dataset scope must not be presented as complete provider coverage.
- Observation page synchronization atomically upserts normalized observations and replaces exact-page membership. Fresh pages avoid the provider; stale pages may fall back to persisted data after a controlled provider failure.
- The observation freshness window defaults to one hour and is configurable with `OBSERVATION_FRESHNESS_WINDOW_SECONDS`.
- External HTTP currently supports only the JSON `GET` behavior required by implemented providers. Retries remain deferred until provider-specific evidence justifies them.
- MapLibre remains isolated in a Client Component. Provider data is flattened to safe scalar properties, rendered features are validated again, and popup content is built with DOM APIs rather than HTML interpolation.
- Initial observation retry uses `router.refresh()` from a small Client Component. Viewport retry remains local to the map and preserves the last successful dataset.
- `NEXT_PUBLIC_API_BASE_URL` is public build-time configuration and must not contain secrets. The optional map style URL defaults to OpenFreeMap Liberty.
- No microservices, Redis, queues, GraphQL, background synchronization, or advanced GIS infrastructure are introduced without a concrete requirement.

## Known limitations / blockers

- HTTP-level integration tests and end-to-end browser tests are not configured yet.
- Persistence integration tests require a running Docker-compatible container runtime and may need to download the PostGIS image.
- CI and production deployment are not configured.
- Concurrent requests for the same missing or stale observation page are not coalesced and may each call the provider.
- Cross-provider grouping currently recognizes only the official GBIF-published iNaturalist dataset. Other provider relationships remain separate unless a future step adds another equally strong identity rule.
- Paginated synchronization remains provider-page based. The public paginated response continues to describe the primary iNaturalist page, while the spatial read combines locally synchronized provider records.
- Observations persisted before step 40 have nullable license and dataset provenance until a later provider synchronization supplies it.
- Bounding-box GeoJSON contains only observations already synchronized into PostgreSQL and is not complete provider coverage.
- Seasonality contains only observations already synchronized into PostgreSQL and is not complete provider coverage.
- Place results link to `/places/[id]/[slug]`, but the route and detail page do not exist until step 46.
- Places are not yet persisted; global search results and their opaque provider-derived IDs come directly from the current adapter.
- The Nominatim cache and rate limiter are process-local. This satisfies the current single-process MVP, but multiple API replicas would not provide an aggregate cross-process one-request-per-second limit and must not share the public endpoint without a different coordination or provider strategy.
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
pnpm build

pnpm db:migrate
pnpm db:migrate:create migration-name
pnpm db:migrate:down

pnpm dev:web
pnpm dev:api
pnpm --filter web start
pnpm --filter api start
```

Run development servers in separate terminals. The frontend defaults to http://localhost:3000 and the API to http://localhost:3001. Build an application before starting its production server.

## Verification

- `pnpm format:check`: passed after step 45.
- Targeted ESLint passed for all files changed in step 45.
- `pnpm --filter web typecheck`: passed after step 45.
- `pnpm --filter api typecheck`: passed after step 45.
- `pnpm --filter api test`: passed all 183 API unit tests after step 45.
- `pnpm test:integration`: passed all 14 PostgreSQL/PostGIS persistence tests after step 42.
- The API production build passed after step 45.
- The default frontend build reaches MapLibre CSS processing but cannot complete in the agent sandbox because Turbopack is denied permission to bind its required local port.
- A policy-compliant live Nominatim smoke request returned Puszcza Niepołomicka as OSM relation `61493` with a center and provider bounding box.
- `git diff --check`: passed after step 45.
- Step 45 Definition of Done is satisfied: one search accepts either a species or a Polish place, groups typed results, preserves partial failures and empty states, and routes each result type toward its intended detail URL.
