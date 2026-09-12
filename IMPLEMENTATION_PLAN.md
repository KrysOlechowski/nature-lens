# 🧭 Nature Lens Implementation Plan

> **Purpose:** take Nature Lens from an empty repository to a working, deployed product while keeping each implementation step small enough to understand, review, test, and explain.

This file is the implementation roadmap used by coding agents working in the repository.

`PROJECT_STATE.md` determines **which item is current**.

When starting work, the agent should:

1. read `AGENTS.md`,
2. read `PROJECT_STATE.md`,
3. find the matching current item in this file,
4. inspect only the additional repository context required for that item,
5. explain the proposed approach,
6. wait for approval before implementation.

The user should **not need to paste the current step manually into every Codex session**.

---

## 🧩 Working rules

- **One implementation step = one logical commit** by default.
- A commit should add one coherent change and leave the repository in a working state.
- If a step turns out to be too large, split it instead of forcing unrelated work into one commit.
- Actions performed only in Supabase, Railway, Vercel, or another external dashboard are marked as **🔵 Manual setup** and do not require artificial commits.
- Before meaningful technical changes, discuss the problem, decision, and trade-offs before implementation.
- After each implementation step, run checks appropriate to the current stage.
- Work only on the **current** plan item. Do not implement future roadmap items opportunistically.
- This plan is allowed to change when implementation reveals that an assumption was wrong.

---

## ✅ Global Definition of Done

For each commit-oriented implementation step:

- [ ] The scope matches one implementation step.
- [ ] There is no unrelated refactoring.
- [ ] TypeScript introduces no new errors.
- [ ] Relevant lint checks pass.
- [ ] Tests exist when the step introduces logic worth testing.
- [ ] Secrets and local `.env` files are not committed.
- [ ] `PROJECT_STATE.md` reflects the resulting project state.
- [ ] The change can be explained in plain language: problem, solution, and important trade-offs.

---

# Phase 1 · Repository foundation

**Outcome:** the Next.js frontend and NestJS backend run locally, share basic tooling, and can communicate with each other.

## 01 · Initialize workspace

**Goal:** create one repository for the web and API applications using a simple workspace structure.

**Implementation:**

- initialize Git,
- configure a `pnpm` workspace,
- create `web` and `api` in the repository root,
- add a basic `.gitignore`.

Root scripts will be added when the applications and tooling provide tasks worth exposing from the repository root.

**Learning:**

- monorepo vs separate repositories,
- workspace dependencies,
- application boundaries.

**Discuss before implementation:**

- why a plain pnpm workspace is enough at this stage instead of Nx or Turborepo.

**Definition of Done:** the repository root recognizes the workspace and dependencies can be installed from the root.

**Commit:** `chore: initialize project workspace`

---

## 02 · Bootstrap Next.js application

**Goal:** create the frontend application.

**Implementation:**

- Next.js 16,
- App Router,
- TypeScript,
- Tailwind CSS,
- remove unnecessary starter content.

**Learning:**

- App Router,
- `app` directory structure,
- Server Components as the default model.

**Definition of Done:** `web` runs locally and renders a simple Nature Lens page.

**Commit:** `feat(web): initialize Next.js application`

---

## 03 · Bootstrap NestJS API

**Goal:** create the backend as a modular monolith.

**Implementation:**

- NestJS in `api`,
- base `AppModule`,
- `/api` prefix.

**Learning:**

- modules,
- controllers,
- providers,
- dependency injection in NestJS.

**Definition of Done:** the API runs locally without requiring a database.

**Commit:** `feat(api): initialize NestJS application`

---

## 04 · Configure shared developer tooling

**Goal:** establish consistent code-quality tooling across both applications.

**Implementation:**

- root scripts for lint/typecheck/build,
- Prettier,
- minimal shared conventions without creating a configuration framework.

**Learning:**

- lint vs typecheck vs formatting.

**Definition of Done:** one set of root commands can check both applications.

**Commit:** `chore: configure shared developer tooling`

---

## 05 · Add typed environment configuration

**Goal:** avoid unvalidated `process.env` usage scattered throughout the codebase.

**Implementation:**

- `.env.example`,
- environment configuration for web and API,
- startup validation for required values.

**Learning:**

- secrets vs public environment variables,
- build-time vs runtime environment configuration in Next.js.

**Definition of Done:** applications fail fast when required configuration is missing, and secrets are not committed to Git.

**Commit:** `chore: validate application environment`

---

## 06 · Add API health endpoint

**Goal:** establish the simplest stable backend contract and a future deployment health check.

**Implementation:**

- `GET /api/health`,
- simple response DTO.

**Learning:**

- controllers,
- HTTP status codes,
- API contracts.

**Definition of Done:** the endpoint reliably returns `200` with a predictable status/version payload.

**Commit:** `feat(api): add health endpoint`

---

## 07 · Connect Next.js to Nature Lens API

**Goal:** complete the first tiny frontend → backend vertical slice.

**Implementation:**

- server-side fetch of the health endpoint,
- simple backend status on a developer-facing page.

**Learning:**

- Server Component fetching,
- API URL configuration,
- network failures.

**Definition of Done:** Next.js fetches a response from NestJS without contacting any external provider.

**Commit:** `feat(web): connect frontend to API`

---

# Phase 2 · PostgreSQL and PostGIS

**Outcome:** the backend has a controlled persistence layer and the first domain models prepared for spatial data.

## 🔵 Manual setup · Create development Supabase project

Create a Supabase project for the development environment.

Store the connection string locally, never in Git.

Do not configure production yet.

---

## 08 · Configure PostgreSQL access

**Goal:** connect NestJS to PostgreSQL.

**Implementation:**

- persistence-layer configuration,
- connection pooling,
- choose an integration that works well with NestJS while still allowing explicit SQL for PostGIS.

**Learning:**

- connection pools,
- ORM/query layer vs SQL,
- connection lifecycle.

**Discuss before implementation:**

- database library choice,
- why the project should not hide all SQL behind an ORM.

**Definition of Done:** the API connects to the database and can execute a simple connection check.

**Commit:** `feat(api): configure PostgreSQL persistence`

---

## 09 · Add database migrations and enable PostGIS

**Goal:** version the database schema inside the repository.

**Implementation:**

- migration mechanism,
- migration containing `CREATE EXTENSION postgis`.

**Learning:**

- migrations,
- schema evolution,
- PostgreSQL extensions.

**Definition of Done:** a clean database can be recreated exclusively from migrations.

**Commit:** `feat(db): add migrations and enable PostGIS`

---

## 10 · Add Species domain model

**Goal:** define the application's species model independently of iNaturalist or GBIF.

**Implementation:**

- `species` table,
- internal ID,
- scientific name,
- display/common name,
- basic taxonomy,
- timestamps.

**Learning:**

- domain model vs provider response,
- internal vs external identifiers.

**Definition of Done:** a migration creates the table with sensible constraints.

**Commit:** `feat(db): add species model`

---

## 11 · Add Observation geospatial model

**Goal:** store observations together with location and data provenance.

**Implementation:**

- observations table,
- PostGIS `Point`,
- observation timestamp,
- provider,
- external ID,
- accuracy/obscured-location metadata,
- source information.

**Learning:**

- `geometry` vs `geography`,
- SRID 4326,
- observational data,
- provenance.

**Definition of Done:** the system can persist a point with valid coordinates and source information.

**Commit:** `feat(db): add geospatial observation model`

---

## 12 · Add spatial and lookup indexes

**Goal:** support expected real queries before spatial data volume becomes a performance problem.

**Implementation:**

- GiST index on location,
- indexes/unique constraints for provider IDs,
- indexes supporting species-observation relations.

**Learning:**

- B-tree vs GiST,
- indexing vs write cost.

**Definition of Done:** indexes are defined in migrations and each one can be connected to a real query pattern.

**Commit:** `perf(db): add observation query indexes`

---

## 13 · Add persistence integration test foundation

**Goal:** avoid testing SQL and PostGIS exclusively through mocks.

**Implementation:**

- integration-test infrastructure using real PostgreSQL/PostGIS,
- isolated database state for tests.

**Learning:**

- unit vs integration tests,
- database test isolation.

**Definition of Done:** an integration test can persist and read a sample record.

**Commit:** `test(api): add database integration test setup`

---

# Phase 3 · iNaturalist and the first backend vertical slice

**Outcome:** the API can search species and fetch real observations from Poland through an isolated provider adapter and internal models.

## 14 · Add external HTTP client foundation

**Goal:** avoid scattering uncontrolled external HTTP calls throughout services.

**Implementation:**

- shared HTTP layer in NestJS,
- timeout,
- basic logging,
- provider identification.

**Learning:**

- timeout vs retry,
- transport failures,
- dependency injection.

**Definition of Done:** provider integrations can use one controlled HTTP client foundation.

**Commit:** `feat(api): add external HTTP client foundation`

---

## 15 · Validate iNaturalist API responses

**Goal:** do not trust compile-time TypeScript types for data received from the internet.

**Implementation:**

- runtime schemas for only the parts of iNaturalist responses actually used by the application.

**Learning:**

- compile-time types vs runtime validation,
- defensive programming.

**Definition of Done:** an invalid provider contract produces a controlled integration error.

**Commit:** `feat(api): validate iNaturalist responses`

---

## 16 · Add iNaturalist species search adapter

**Goal:** search species through the first real provider.

**Implementation:**

- `INaturalistAdapter`,
- taxa-search method limited to application needs.

**Learning:**

- adapter pattern,
- anti-corruption layer around an external integration.

**Definition of Done:** the adapter returns a small internal integration type rather than a raw iNaturalist response.

**Commit:** `feat(api): add iNaturalist species search adapter`

---

## 17 · Normalize provider species into domain model

**Goal:** separate the iNaturalist model from the Nature Lens model.

**Implementation:**

- mapper/normalizer,
- mapping rules for names, taxonomy, and provider IDs.

**Learning:**

- boundary mapping,
- when a mapper is useful and when it becomes unnecessary abstraction.

**Definition of Done:** the domain service does not import iNaturalist response types.

**Commit:** `feat(api): normalize iNaturalist species data`

---

## 18 · Expose species search endpoint

**Goal:** make the frontend use the Nature Lens API rather than the provider directly.

**Implementation:**

- `GET /api/species/search?q=...`,
- query validation,
- response DTO.

**Learning:**

- REST resource design,
- DTOs,
- validation,
- error status codes.

**Definition of Done:** a query such as `jeleń` returns normalized results.

**Commit:** `feat(api): expose species search endpoint`

---

## 19 · Add iNaturalist observations adapter

**Goal:** fetch observations for a selected species restricted to Poland.

**Implementation:**

- provider method for observations,
- country/taxon filters,
- required pagination.

**Learning:**

- pagination,
- query parameters,
- adapter responsibilities.

**Definition of Done:** the adapter can return real observations of a species from Poland.

**Commit:** `feat(api): add iNaturalist observations adapter`

---

## 20 · Normalize observations and protect sensitive coordinates

**Goal:** explicitly treat records as observations and never increase the precision of hidden locations.

**Implementation:**

- observation mapper,
- accuracy/obscured-coordinate metadata,
- explicit rule: never reconstruct information the provider did not reveal.

**Learning:**

- data ethics,
- data quality,
- provenance.

**Definition of Done:** the model preserves limited-precision information and the application does not attempt to bypass provider restrictions.

**Commit:** `feat(api): normalize observation data safely`

---

## 21 · Expose live species observations endpoint

**Goal:** complete the backend slice before introducing persistence/caching.

**Implementation:**

- species observations endpoint using the iNaturalist adapter.

**Learning:**

- orchestration service,
- external dependency boundaries.

**Definition of Done:** the API returns observation DTOs containing location, date, and source.

**Commit:** `feat(api): expose species observations endpoint`

---

## 22 · Add provider error translation

**Goal:** prevent iNaturalist failures from leaking as arbitrary `500` responses containing HTTP-library details.

**Implementation:**

- controlled timeout,
- rate-limit,
- provider-unavailable errors,
- mapping to stable API errors.

**Learning:**

- error taxonomy,
- 4xx vs 5xx vs 503/504.

**Definition of Done:** common provider failures produce predictable responses and useful logs.

**Commit:** `feat(api): translate external provider errors`

---

# Phase 4 · Persistence, synchronization, and PostGIS

**Outcome:** the application is no longer only a proxy to iNaturalist. It can store data, refresh it, and execute its own spatial queries.

## 23 · Persist normalized species

**Goal:** store species in the internal model and maintain external-ID mapping.

**Implementation:**

- repository,
- idempotent species/provider mapping upsert.

**Learning:**

- upsert,
- idempotency,
- source identifiers.

**Definition of Done:** searching the same species repeatedly does not create duplicates.

**Commit:** `feat(api): persist normalized species`

---

## 24 · Persist normalized observations

**Goal:** locally store the observation dataset needed by maps and analysis.

**Implementation:**

- batch observation upsert,
- provider ID as part of deduplication,
- persist PostGIS points.

**Learning:**

- batch writes,
- transactions,
- idempotency.

**Definition of Done:** synchronizing the same range repeatedly does not duplicate records.

**Commit:** `feat(api): persist normalized observations`

---

## 25 · Add on-demand synchronization policy

**Goal:** establish the first practical answer to "live provider or local database?"

**Implementation:**

- read-through/on-demand synchronization,
- freshness timestamp,
- no queues or cron jobs yet.

**Learning:**

- cache-aside/read-through,
- freshness vs latency.

**Discuss before implementation:**

- when cached data is returned,
- when it is refreshed,
- why Redis is not yet necessary.

**Definition of Done:** repeated requests can use sufficiently fresh local data instead of always contacting the provider.

**Commit:** `feat(api): add observation sync freshness policy`

---

## 26 · Query observations by bounding box with PostGIS

**Goal:** prepare the backend for an interactive map.

**Implementation:**

- repository query for bounding box,
- sensible limits,
- return only records needed for the visible map region.

**Learning:**

- bounding boxes,
- spatial filtering,
- PostGIS functions/operators,
- spatial indexes.

**Definition of Done:** bbox queries for Poland or a region use local data and have an integration test.

**Commit:** `feat(api): query observations by bounding box`

---

## 27 · Return observations as GeoJSON

**Goal:** expose a representation that works naturally with MapLibre.

**Implementation:**

- endpoint/representation using `FeatureCollection<Point>`,
- only required properties.

**Learning:**

- GeoJSON,
- Feature/FeatureCollection,
- `[longitude, latitude]`.

**Definition of Done:** the response is valid GeoJSON and does not contain unnecessary provider fields.

**Commit:** `feat(api): expose observation GeoJSON`

---

# Phase 5 · First working frontend product

**Outcome:** a user searches for a species, opens its page, and sees real observations on an interactive map of Poland.

## 28 · Initialize shadcn/ui foundation

**Goal:** establish a small set of consistent components without building a custom design system from scratch.

**Implementation:**

- initialize shadcn/ui,
- add only basic components needed soon.

**Learning:**

- copy-owned components vs package dependency,
- accessibility primitives.

**Definition of Done:** the application has basic Button/Input/Card components without bulk-installing the component library.

**Commit:** `feat(web): initialize UI component foundation`

---

## 29 · Build species search UI

**Goal:** create the primary application entry point: "Search for a place, forest, or species", initially supporting species.

**Implementation:**

- search input,
- submit flow,
- result list,
- keyboard-friendly UX.

**Learning:**

- controlled vs uncontrolled input,
- URL state,
- accessibility.

**Definition of Done:** species search uses `/species/search`.

**Commit:** `feat(web): add species search experience`

---

## 30 · Add species detail route

**Goal:** provide a stable URL for a species.

**Implementation:**

- `species/[id]`,
- server-side species data fetch,
- not-found/error handling.

**Learning:**

- dynamic routes,
- Server Components,
- route params.

**Definition of Done:** selecting a search result opens the selected species page.

**Commit:** `feat(web): add species detail page`

---

## 31 · Add MapLibre base map

**Goal:** initialize the map as an isolated Client Component.

**Implementation:**

- MapLibre GL,
- map style,
- basic controls,
- client/lazy boundary where appropriate.

**Learning:**

- why a map library requires browser lifecycle,
- map rendering vs React rendering.

**Definition of Done:** the species page renders a stable map of Poland.

**Commit:** `feat(web): add MapLibre base map`

---

## 32 · Render observation GeoJSON on the map

**Goal:** display real Nature Lens data.

**Implementation:**

- GeoJSON source,
- point layer,
- source data from the Nature Lens API.

**Learning:**

- MapLibre sources and layers,
- GeoJSON rendering.

**Definition of Done:** real observations for the selected species appear as map points.

**Commit:** `feat(web): render species observations on map`

---

## 33 · Fetch observations by current map bbox

**Goal:** avoid downloading observations for all of Poland after every map movement.

**Implementation:**

- viewport bbox,
- request on `moveend`,
- limits/zoom guard.

**Learning:**

- viewport-driven fetching,
- network and rendering cost.

**Definition of Done:** moving the map fetches data only for the current area.

**Commit:** `feat(web): fetch observations by map bounds`

---

## 34 · Add request debounce and stale-request protection

**Goal:** prevent rapid map movements from creating request storms or race conditions.

**Implementation:**

- debounce/cancellation or request identity,
- ignore stale responses.

**Learning:**

- UI race conditions,
- `AbortController`,
- debounce vs throttle.

**Definition of Done:** rapid map movement does not cause older data to overwrite newer map state.

**Commit:** `perf(web): stabilize viewport observation requests`

---

## 35 · Add observation clustering and popup details

**Goal:** keep the map readable with larger numbers of points.

**Implementation:**

- MapLibre clustering,
- popup containing observation date, source, basic metadata,
- approximate-location notice when applicable.

**Learning:**

- client-side clustering,
- zoom-dependent representation.

**Definition of Done:** dense observations are clustered and individual observations expose useful details.

**Commit:** `feat(web): add observation clustering and details`

---

## 36 · Add progressive loading and section-level errors

**Goal:** prepare the UX for multiple independent providers.

**Implementation:**

- independent loading/error/empty states,
- section-level retry,
- Suspense/error boundaries only where they actually help.

**Learning:**

- partial-failure UX,
- progressive loading.

**Definition of Done:** an observations failure does not break the entire species page.

**Commit:** `feat(web): add progressive loading states`

---

> ## 🏁 Milestone A
>
> After step 36, the first complete vertical slice works locally:
>
> **Next.js → NestJS → iNaturalist → PostgreSQL/PostGIS → GeoJSON → MapLibre**

---

# Phase 6 · GBIF, provenance, and first analyses

**Outcome:** the species page uses more than one biodiversity source and can show historical/seasonal patterns, not only current map points.

## 37 · Add GBIF occurrence adapter

**Goal:** add a second biodiversity provider without changing the frontend to match its response format.

**Implementation:**

- validated GBIF occurrence adapter restricted to Poland.

**Learning:**

- a second provider as a real test of earlier architecture.

**Definition of Done:** the adapter returns the same domain observation shape used for iNaturalist.

**Commit:** `feat(api): add GBIF occurrence adapter`

---

## 38 · Generalize biodiversity provider contract

**Goal:** generalize only after two real implementations exist.

**Implementation:**

- provider interface/capabilities shared by iNaturalist and GBIF,
- avoid forcing artificial symmetry.

**Learning:**

- correct timing for abstraction,
- interface segregation.

**Definition of Done:** orchestration no longer depends directly on concrete provider classes.

**Commit:** `refactor(api): introduce biodiversity provider contract`

---

## 39 · Preserve source provenance across providers

**Goal:** ensure users and the system always know where an observation came from.

**Implementation:**

- provider,
- source URL,
- license,
- dataset metadata in model/response.

**Learning:**

- provenance,
- attribution,
- data licenses.

**Definition of Done:** normalization never removes the observation's source information.

**Commit:** `feat(api): preserve observation provenance`

---

## 40 · Add conservative cross-provider deduplication

**Goal:** reduce obvious duplicates without pretending the same real-world record can always be perfectly identified across datasets.

**Implementation:**

- explicit identity/deduplication strategy,
- preserve uncertainty,
- preserve source links.

**Learning:**

- fuzzy identity,
- false positives vs false negatives.

**Definition of Done:** obvious duplicates can be grouped while original source records remain traceable.

**Commit:** `feat(api): deduplicate biodiversity observations conservatively`

---

## 41 · Add observation seasonality aggregation

**Goal:** answer "when was this species observed?"

**Implementation:**

- SQL aggregation by month/year,
- endpoint,
- simple chart/section on the species page.

**Learning:**

- SQL aggregations,
- observational-data interpretation,
- correlation vs presence.

**Definition of Done:** the species page shows observation distribution over time with appropriate limitations explained.

**Commit:** `feat: add species observation seasonality`

---

# Phase 7 · Place page and progressive multi-source UI

**Outcome:** the second primary product flow works: **place → observations + weather + protected areas**.

## 42 · Add Place domain contract

**Goal:** define the application's own place model before adding geocoding.

**Implementation:**

- place ID/slug,
- label,
- bbox/center,
- place type,
- search contract.

**Learning:**

- place search vs geocoding,
- bounding box as domain information.

**Definition of Done:** frontend and backend share a stable internal place contract.

**Commit:** `feat(api): add place domain contract`

---

## 43 · Add OSM-backed place search adapter

**Goal:** search Polish places using an appropriate geocoding provider backed by OpenStreetMap data.

**Implementation:**

- adapter,
- restriction to Poland,
- response validation,
- respect the usage policy of the chosen endpoint.

**Learning:**

- OSM as a dataset rather than "one API",
- geocoding,
- provider policies.

**Discuss before implementation:**

- verify the current terms and usage limits of the selected service,
- verify that it is suitable for expected production traffic.

**Definition of Done:** search can return a place such as Niepołomice Forest with center/bbox information.

**Commit:** `feat(api): add place search provider`

---

## 44 · Extend global search with places

**Goal:** make one search experience support species and places.

**Implementation:**

- typed search results,
- grouping species/place results,
- routing to the correct page.

**Learning:**

- polymorphic search results,
- mixed search UX.

**Definition of Done:** a user can enter either a species or a place.

**Commit:** `feat(web): support place search results`

---

## 45 · Add place detail page with map extent

**Goal:** create the second primary product page.

**Implementation:**

- place route,
- basic header,
- map positioned using place bbox/center.

**Learning:**

- reusing map components without creating a god component.

**Definition of Done:** selecting a place opens its own page and the map shows the correct area.

**Commit:** `feat(web): add place detail page`

---

## 46 · Show biodiversity observations inside a place

**Goal:** reuse the observations capability in a new product context.

**Implementation:**

- spatial query by bbox/area,
- counts/list,
- map layer.

**Learning:**

- reuse of backend capabilities,
- "observations inside an area" vs "species definitely occurs here".

**Definition of Done:** the place page shows locally stored observations for the visible area.

**Commit:** `feat: show observations for places`

---

## 47 · Add Open-Meteo weather section

**Goal:** add the first independent environmental section.

**Implementation:**

- Open-Meteo adapter,
- internal weather DTO,
- independently loaded temperature/precipitation/wind section.

**Learning:**

- different data freshness requirements,
- progressive loading.

**Definition of Done:** a weather-provider failure does not block the map or biodiversity observations.

**Commit:** `feat: add place weather data`

---

## 48 · Add GDOŚ protected areas layer

**Goal:** show protected areas within or around a place.

**Implementation:**

- adapter for the appropriate official GDOŚ public source,
- normalize Polygon/MultiPolygon,
- API,
- MapLibre layer.

**Learning:**

- WFS/OGC API or the actual format offered by the source,
- polygon geometry.

**Discuss before implementation:**

- verify the current official endpoint,
- verify usage conditions.

**Definition of Done:** protected areas are available as a separate toggleable layer with attribution.

**Commit:** `feat: add protected areas map layer`

---

> ## 🏁 Milestone B
>
> After step 48, the application has a meaningful MVP:
>
> search, species page, place page, real biodiversity data, weather, protected areas, PostGIS, and an interactive map.

---

# Phase 8 · Multi-provider resilience and performance

**Outcome:** external APIs can be slow or partially unavailable without breaking the entire application.

## 49 · Add per-provider timeout and retry policies

**Goal:** explicitly control behavior around slow and unstable APIs.

**Implementation:**

- provider-specific timeout,
- conservative retry for appropriate failures only,
- bounded exponential backoff.

**Learning:**

- retry storms,
- idempotency,
- timeout budgets.

**Definition of Done:** resilience behavior is testable and does not blindly retry every failure.

**Commit:** `feat(api): add provider resilience policies`

---

## 50 · Add provider-aware caching

**Goal:** reduce latency and unnecessary external API requests.

**Implementation:**

- caching with TTL/freshness appropriate to each data type,
- initially use existing infrastructure,
- do not automatically add Redis.

**Learning:**

- cache keys,
- stale data,
- invalidation,
- HTTP/data caching.

**Definition of Done:** repeated requests do not hit providers unnecessarily.

**Commit:** `perf(api): add provider-aware caching`

---

## 51 · Add rate limiting and request protection

**Goal:** protect the API and indirectly protect external sources.

**Implementation:**

- public endpoint limits,
- limits for expensive bbox/search requests,
- sensible maximum bounds/page size.

**Learning:**

- abuse protection,
- rate-limit semantics,
- backpressure.

**Definition of Done:** pathological request volume does not scale linearly into provider traffic.

**Commit:** `feat(api): add API request protection`

---

## 52 · Add structured logging and request correlation

**Goal:** make failures diagnosable instead of producing unrelated log fragments.

**Implementation:**

- structured logs,
- request/correlation ID,
- provider,
- latency,
- status,
- never log secrets.

**Learning:**

- observability,
- log context.

**Definition of Done:** a request can be followed through controller → service → provider.

**Commit:** `feat(api): add structured request logging`

---

## 53 · Add provider health and partial-failure metadata

**Goal:** allow the frontend to know that one provider is unavailable while others still work.

**Implementation:**

- explicit provider/section status where useful,
- keep operational status separate from domain data.

**Learning:**

- degraded mode,
- partial availability.

**Definition of Done:** the UI can show "some data is temporarily unavailable" instead of a global failure.

**Commit:** `feat: surface partial provider failures`

---

# Phase 9 · End-to-end testing and CI

**Outcome:** important system boundaries are tested and each change can be verified automatically.

## 54 · Add focused unit tests for domain mapping

**Goal:** protect normalization logic that is especially sensitive to provider changes.

**Implementation:**

- iNaturalist/GBIF mapper tests,
- invalid data,
- sensitive-location rules,
- deduplication behavior.

**Learning:**

- behavior testing vs implementation-detail testing.

**Definition of Done:** critical mapper cases have fast deterministic tests.

**Commit:** `test(api): cover biodiversity domain mapping`

---

## 55 · Expand API integration tests

**Goal:** verify controller/service/database/PostGIS behavior without mocking every layer.

**Implementation:**

- search/observations/bbox endpoints,
- stub only the external provider,
- use a real test database.

**Learning:**

- test pyramid,
- testing system boundaries.

**Definition of Done:** the critical API flow works against the real database schema.

**Commit:** `test(api): add critical API integration coverage`

---

## 56 · Add end-to-end happy-path test

**Goal:** test the product from the user's perspective.

**Implementation:**

- Playwright:
  - species search → species page → map/data,
  - place search → place page.

**Learning:**

- E2E as a small number of high-value tests.

**Definition of Done:** both primary journeys pass locally and in CI.

**Commit:** `test(e2e): cover primary user journeys`

---

## 57 · Add CI quality pipeline

**Goal:** automatically prevent obvious regressions.

**Implementation:**

- GitHub Actions:
  - install,
  - lint,
  - typecheck,
  - test,
  - build,
- dependency caching.

**Learning:**

- CI pipelines,
- fail-fast behavior,
- deterministic builds.

**Definition of Done:** pull requests have one clear quality gate.

**Commit:** `ci: add application quality pipeline`

---

# Phase 10 · Production deployment

**Outcome:** Nature Lens is available under a public URL with separate web/API/database deployment and an end-to-end smoke check.

## 58 · Containerize NestJS for production

**Goal:** create a reproducible backend deployment artifact.

**Implementation:**

- multi-stage Dockerfile,
- production dependencies,
- healthcheck-ready startup,
- `.dockerignore`.

**Learning:**

- image layers,
- build vs runtime,
- image minimization.

**Definition of Done:** the API runs locally from the production image.

**Commit:** `build(api): add production Docker image`

---

## 🔵 Manual setup · Production Supabase

Create or select the production database.

Configure secure access and secrets.

Run migrations rather than manually recreating the development schema.

---

## 59 · Add production migration command

**Goal:** avoid manually clicking SQL commands during deployment.

**Implementation:**

- safe production migration command/script,
- documented deployment order.

**Learning:**

- forward-only migrations,
- deployment ordering.

**Definition of Done:** a new empty database can be prepared entirely from the repository.

**Commit:** `chore(db): add production migration workflow`

---

## 🔵 Manual setup · Railway API service

Connect the repository.

Configure backend build/deployment, secrets, health endpoint, and production `DATABASE_URL`.

---

## 60 · Add production API configuration

**Goal:** make the backend behave correctly behind the hosting platform.

**Implementation:**

- trusted origins/CORS,
- port configuration,
- proxy-aware settings if required,
- production logging,
- public API base-URL conventions.

**Definition of Done:** the deployed backend responds correctly on `/api/health` and critical endpoints.

**Commit:** `chore(api): configure production runtime`

---

## 🔵 Manual setup · Vercel web project

Connect `web`.

Configure the production API URL and required public MapLibre/style-provider variables.

Keep secrets on the server/API side.

---

## 61 · Add production web configuration

**Goal:** make the frontend use the production API correctly and expose production-safe metadata/error handling.

**Implementation:**

- environment wiring,
- metadata,
- production-safe fetch configuration.

**Definition of Done:** the Vercel build succeeds and the site communicates with the Railway API.

**Commit:** `chore(web): configure production deployment`

---

## 62 · Add post-deploy smoke test

**Goal:** verify that a successful deployment actually means the product works.

**Implementation:**

- small smoke script/test covering:
  - health,
  - species search,
  - a critical map-data endpoint.

**Learning:**

- "deployment succeeded" is not the same as "product works".

**Definition of Done:** the test can identify failures across web/API/database/provider boundaries after deployment.

**Commit:** `test: add production smoke checks`

---

## 63 · Document architecture and production runbook

**Goal:** close the first version with documentation that can be defended in an interview and used by another engineer.

**Implementation:**

- refine README with architecture/local setup/data flow/deployment,
- short runbook for common failures,
- important trade-offs.

**Learning:**

- documenting and explaining a production system.

**Definition of Done:** a new engineer can run the project and understand the main flow without reading the entire codebase.

**Commit:** `docs: document architecture and operations`

---

> ## 🏁 Milestone C · Nature Lens V1
>
> After step 63, the application is publicly deployed and includes both primary product flows, real data, its own backend/database/PostGIS layer, progressive loading, basic resilience, automated tests, and CI/CD.

---

# Phase 11 · Post-V1 extensions

This phase is part of the product direction but **does not block V1**.

Enter it only after V1 is deployed and there is evidence that additional datasets improve the product.

## 64 · Add BDL forestry adapter

**Goal:** enrich forest-place pages with Bank Danych o Lasach data.

**Before implementation:**

- verify the current official access method,
- verify spatial formats,
- verify usage conditions.

**Implementation:** build the smallest adapter required for the first visible forestry use case.

**Commit:** `feat: add BDL forestry data provider`

---

## 65 · Add forestry map layer and place section

**Goal:** display BDL data without mixing it conceptually with biodiversity observations.

**Implementation:**

- separate layer/section,
- legends,
- attribution.

**Commit:** `feat(web): add forestry data experience`

---

## 66 · Add IMGW official measurements adapter

**Goal:** complement Open-Meteo with official Polish measurements or warnings where they add product value.

**Before implementation:** select a specific IMGW dataset/API instead of attempting to integrate "all of IMGW".

**Commit:** `feat(api): add IMGW data provider`

---

## 67 · Add IMGW section with source distinction

**Goal:** clearly distinguish model/forecast data from official measurements/warnings.

**Implementation:**

- independent section,
- explicit source,
- measurement timestamp.

**Commit:** `feat(web): add official IMGW data section`

---

## 68 · Add OSM infrastructure/POI layer

**Goal:** enrich place pages with only the OSM POIs users actually need, such as parking, entrances, or selected paths/infrastructure.

**Before implementation:**

- define a narrow tag set,
- select an appropriate data-access method,
- do not turn the application into a general OSM client.

**Commit:** `feat: add selected OSM infrastructure layer`

---

## 69 · Add scheduled background synchronization only if needed

**Goal:** introduce background processing only when on-demand synchronization becomes a real limitation.

**Implementation:**

- scheduler/queue only for concrete datasets,
- measure operational cost,
- preserve job idempotency.

**Learning:**

- when synchronous request-based synchronization stops being sufficient,
- background-job idempotency.

**Commit:** `feat(api): add background data synchronization`

---

## 70 · Add Redis only if measurements justify it

**Goal:** avoid infrastructure without a problem to solve.

**Entry condition:** measurable caching, rate-limiting, or coordination problems exist that are not handled well by the database or platform-level caching.

**Commit:** `perf: introduce Redis-backed caching`

---

# 🧠 Learning checkpoints

## After Milestone A, I should be able to explain

- Server vs Client Components in the context of a real interactive map.
- Why the frontend calls NestJS instead of iNaturalist directly.
- Adapter pattern applied to a concrete integration problem.
- Runtime validation of external API responses.
- GeoJSON and basic geometry types.
- Why PostGIS and a GiST index are useful.
- How bounding boxes reduce map-data volume.
- Debouncing and race conditions during map movement.

---

## After Milestone B, I should be able to explain

- How two biodiversity sources are normalized.
- Why observation deduplication is probabilistic.
- Data provenance and attribution.
- Progressive loading and partial failures.
- Polygon/MultiPolygon data and MapLibre layers.
- Page-level orchestration for multiple providers.

---

## After Milestone C, I should be able to explain

- Cache freshness, retries, timeouts, and rate limiting with their trade-offs.
- Unit vs integration vs E2E tests and why each exists in this project.
- Deployment of Next.js + NestJS + PostgreSQL/PostGIS.
- How to diagnose a partial external-provider failure.
- Which architectural components were deliberately not added and why.
- How the system could evolve if traffic and data volume grew by 10× or 100×.

---

# 🌱 Final rule

> **Do not execute this plan mechanically.**
>
> If implementation reveals that a step is too large, an earlier decision was wrong, or a real external API behaves differently than expected, update the plan deliberately.
>
> The objective is not to "complete 70 commits". The objective is to build a product whose architecture and code are genuinely understood.
