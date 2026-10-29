# Nature Lens production runbook

This runbook covers the deployed V1: Next.js on Vercel, the NestJS API on Render, and PostgreSQL/PostGIS on Supabase. It is a diagnosis and safe-recovery guide, not a substitute for platform administration documentation.

Never paste connection strings, tokens, provider responses, request headers, or environment-variable values into issues or logs. Refer to secret configuration by variable name only.

## Production endpoints and first response

- Web: <https://nature-lens-poland.vercel.app>
- API health: <https://nature-lens-api.onrender.com/api/health>
- End-to-end check: `pnpm smoke:production`

Start with the smallest failing boundary:

1. Open the web root.
2. Request `/api/health` directly.
3. Run the production smoke check from a trusted local or CI environment.
4. Record the failing smoke stage, HTTP status, UTC time, and any `X-Request-ID`.
5. Inspect the deployment and logs for that boundary before changing configuration.

Do not repeatedly restart services or rerun migrations without a new hypothesis. A provider outage, database problem, CORS mismatch, and stale cache require different actions.

## Web on Vercel does not load

**Symptom:** The production URL returns an error, a blank page, or a Vercel deployment failure.

**Check:** Confirm that the latest production deployment completed, its root directory is `web`, and `NEXT_PUBLIC_API_BASE_URL` is a valid HTTP(S) origin without `/api`. If the failure followed an environment change, confirm that a new deployment was created. Check whether the failure affects only an interactive map or the whole route.

**Logs:** Use the Vercel build log for compilation and environment-validation failures, and Vercel runtime logs for server-rendering failures. Browser developer tools are useful only after the document loads.

**Safe action:** Redeploy the last known-good web artifact if it remains API/schema compatible. For a bad build-time value, correct the Vercel variable and create a new deployment. Do not put server secrets into `NEXT_PUBLIC_*` variables.

## Web loads but the Render API does not respond

**Symptom:** Server-rendered data, searches, or maps fail, and the API origin times out or returns a platform error.

**Check:** Request `/api/health` directly. In Render, verify that the latest deployment is live, the service has not crashed or suspended, the runtime `PORT` is supplied by the platform, and the Docker health check is not failing. Check whether the API is starting repeatedly.

**Logs:** Inspect the Render deploy log first, then the runtime log around the failing UTC time.

**Safe action:** Restart the existing deployment only when logs indicate a transient process or platform failure. If a new artifact fails before serving health, redeploy a known-good API artifact only when it is compatible with the current database schema. Otherwise prepare a forward fix.

## `/api/health` fails

**Symptom:** `/api/health` does not return HTTP 200 with the expected `{ "status": "ok", "version": "1" }` contract.

**Check:** Determine whether the response is a timeout, a Render platform error, an application error, or a contract mismatch. The API verifies its database connection before startup, so repeated startup failures often indicate configuration or database reachability rather than the health controller itself.

**Logs:** Check Render startup logs for `Invalid API environment configuration`, database connection errors, migrations/schema errors, and the final process exit.

**Safe action:** Correct the specific validated environment variable, database reachability issue, or schema mismatch and deploy again. Do not weaken startup validation or replace health with a static platform response.

## Supabase/PostGIS connection failure

**Symptom:** The API cannot start, database-backed routes return errors, or logs show PostgreSQL connection, TLS, authentication, pool, or missing PostGIS-function failures.

**Check:** Verify that `DATABASE_URL` is the intended production runtime connection, credentials have not expired, SSL requirements match Supabase, and the selected direct or pooler endpoint is reachable from Render. Check Supabase project status and connection limits. Distinguish a network/authentication failure from a missing schema object.

**Logs:** Correlate Render database errors with Supabase database logs and connection metrics at the same UTC time. Do not copy the connection string into the incident record.

**Safe action:** Restore valid secret configuration or platform connectivity. If the pool is exhausted, identify leaked or excess clients before increasing limits; `DATABASE_POOL_MAX` is bounded deliberately. If PostGIS or an application object is missing, follow the migration procedure rather than editing production manually.

## Migration missing or schema mismatch

**Symptom:** A new API deployment starts failing after release, SQL reports a missing relation/column/function, or repository migrations and `pgmigrations` disagree.

**Check:** Confirm the deployed API revision and whether `pnpm db:migrate:production` ran before it. Review the migration command result for order checks, advisory-lock failure, or transaction rollback. Verify that `MIGRATION_DATABASE_URL` targeted the same production database used by the API's `DATABASE_URL`.

**Logs:** Use the migration job output, Render deploy/runtime logs, and Supabase PostgreSQL logs. Record migration filenames, not credentials.

**Safe action:** If a committed migration is pending and correct, rerun `pnpm db:migrate:production` once after confirming no other runner is active. Re-running is idempotent because completed migrations are recorded. If an applied migration is wrong, create a new forward migration. Never run `pnpm db:migrate:down` against production.

## CORS blocks web-to-API requests

**Symptom:** Server rendering works, but browser map refreshes or client-side API calls fail with a CORS error.

**Check:** Compare the browser request `Origin` with Render's `WEB_ORIGIN`. It must match exactly, including scheme and hostname, with no path or trailing slash difference. Confirm that Vercel's `NEXT_PUBLIC_API_BASE_URL` points to the Render origin without `/api`, then verify both services were redeployed after their environment changes.

**Logs:** Use the browser network panel to capture the request origin, response status, and `X-Request-ID` if present. Inspect the correlated Render request log. Browser console wording alone is not enough to identify the server-side cause.

**Safe action:** Correct the exact origin configuration and redeploy the affected service. Do not use `*`, add credentials, or broadly allow every Vercel preview origin as an emergency workaround.

## One external provider is unavailable

**Symptom:** Species search, observation synchronization, place search, weather, or protected areas fail while `/api/health` remains healthy.

**Check:** Identify the provider and operation from structured API logs. Distinguish timeout, network failure, retryable 502/503/504, non-retried 429/500, invalid JSON, and contract-validation failure. Check the provider's official status information when available, without replaying high-volume requests.

**Logs:** Filter Render logs by `requestId`, provider, and operation. Provider transport logs intentionally contain query-free paths and stable error categories rather than payloads or full URLs.

**Safe action:** Preserve the existing partial-failure behavior and wait for recovery when the problem is external. Do not increase retries blindly: Nominatim is never retried, and 429, 500, invalid JSON, and validation errors are intentionally non-retryable. A provider contract change requires an adapter validation/mapping fix and normal deployment.

## Partial failure or stale observation data

**Symptom:** A page remains usable but shows a provider warning, `stale` data, an unavailable section, or locally synchronized counts that appear incomplete.

**Check:** Read the response metadata carefully. Provider `available`, `stale`, and `unavailable` states apply only to that synchronization request. `datasetScope: "locally-synchronized"` means a bbox or seasonality read used only records already stored locally. Check `truncated` separately.

**Logs:** Correlate the response's `X-Request-ID` with Render logs to determine whether the request used a fresh page, attempted a refresh, or fell back to persisted data.

**Safe action:** Do not purge usable cached observations during a provider outage. Retry after the provider recovers or allow the normal freshness window to trigger a refresh. Do not describe request-scoped metadata as global provider health or incomplete local coverage as species absence.

## Nominatim throttling or rate limit

**Symptom:** Place search is slow, returns a provider error, or Nominatim responds with 429.

**Check:** Confirm that the UI remains submit-based rather than autocomplete. Verify only one API process is using the public endpoint, `NOMINATIM_USER_AGENT` identifies the application, and no deployment or script bypasses the shared one-request-per-second queue. A 429 is not retried by design.

**Logs:** Filter Render logs for provider `nominatim`, request attempts, status, and latency. Check deployment scaling and concurrent traffic before blaming an individual request.

**Safe action:** Stop unintended request volume and allow the public service to recover. Do not shorten the queue interval or add retries. Before multiple replicas or higher traffic, move to another compliant OSM-backed service, self-host Nominatim, or introduce aggregate cross-process coordination.

## Production smoke test fails

Run:

```bash
pnpm smoke:production
```

Optional non-secret overrides are `PRODUCTION_WEB_URL`, `PRODUCTION_API_URL`, `SMOKE_SPECIES_QUERY`, and `SMOKE_TIMEOUT_MS`.

**Symptom:** The command exits after the first failed stage.

**Check:** Use the stage to select the boundary:

| Stage              | Boundary checked                                                 |
| ------------------ | ---------------------------------------------------------------- |
| `CONFIG`           | Smoke override format                                            |
| `WEB`              | Vercel server-rendered species search through the configured API |
| `HEALTH`           | Render API health contract                                       |
| `SPECIES_SEARCH`   | Direct API search contract and web/API identity agreement        |
| `OBSERVATION_SYNC` | Normal synchronization, cache, and stale-if-error behavior       |
| `POSTGIS_BBOX`     | Locally stored GeoJSON query over Poland                         |

**Logs:** Record the stage, HTTP status, UTC time, and matching Vercel or Render logs. The smoke command deliberately prints no response payloads or secrets.

**Safe action:** Fix the smallest failing boundary and rerun once. Do not repeatedly rerun `OBSERVATION_SYNC` to force provider recovery. A successful stage with `degraded` provider information is usable by design and must be evaluated separately from a hard failure.

## Request ID and log correlation

**Symptom:** A user-visible API failure needs to be traced through backend work.

**Check:** In the browser network response or direct HTTP response, capture `X-Request-ID`. If only a Render log is available, start from its `requestId`, method, query-free path, status, and timestamp.

**Logs:** Filter Render JSON logs for the exact `requestId`. The same value follows asynchronous controller, service, repository, and provider work and appears in the response-completion log.

**Safe action:** Correlate only within that API request. Do not assume the ID traces Vercel rendering, a separate retry, another API request, or provider-side logs. Inbound `X-Request-ID` values are ignored intentionally.

## Common configuration mismatches

| Symptom                                         | Check                                                                                | Safe correction                                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Web build fails during environment validation   | `NEXT_PUBLIC_API_BASE_URL` is missing or not an HTTP(S) URL                          | Correct it in Vercel and create a new deployment                                             |
| Browser requests target `/api/api/...`          | API base URL incorrectly includes `/api`                                             | Store only the Render origin in `NEXT_PUBLIC_API_BASE_URL`                                   |
| Browser-only requests fail                      | `WEB_ORIGIN` does not exactly equal the production web origin                        | Correct Render configuration and redeploy                                                    |
| All public traffic shares one throttle identity | `TRUST_PROXY` is false behind Render                                                 | Set `TRUST_PROXY=true` only on the trusted Render service and redeploy                       |
| API fails before listening                      | A required value such as `PORT`, `WEB_ORIGIN`, or `DATABASE_URL` is invalid          | Use the validation message and fix that variable                                             |
| Migration changes the wrong database            | `MIGRATION_DATABASE_URL` and runtime `DATABASE_URL` target different environments    | Stop and resolve the target before rerunning                                                 |
| Provider calls time out too quickly or slowly   | A provider-specific `*_HTTP_TIMEOUT_MS` value is outside its intended policy         | Restore the documented value from `api/.env.example` and redeploy                            |
| Data refresh timing is unexpected               | `OBSERVATION_FRESHNESS_WINDOW_SECONDS` or `WEATHER_FRESHNESS_WINDOW_SECONDS` changed | Confirm the intended policy before correcting and redeploying                                |
| Throttling is unexpectedly strict               | Baseline and expensive request limits are inconsistent                               | Check the three `API_*RATE_LIMIT*` variables; the expensive limit cannot exceed the baseline |

Environment changes do not mutate an already built or running deployment. Create a new Vercel deployment for public web variables and redeploy/restart the Render service for API variables.

## Rollback and forward fix

### Application rollback

A rollback means directing traffic to an earlier Vercel or Render artifact. Use it when the earlier artifact is known to work with the **current** database schema and external contracts.

Before rollback:

1. identify the exact failing artifact and last known-good artifact;
2. check whether production migrations were applied;
3. confirm the old artifact can read and write the current schema safely;
4. preserve logs, timestamps, and request IDs for diagnosis;
5. run health and the production smoke check after rollback.

Do not roll back an application artifact across an incompatible schema change merely because the platform makes artifact selection easy.

### Forward fix

A forward fix is a new code, configuration, or migration change deployed through the normal release path. It is the default for production database and data problems because destructive schema reversal is riskier and the migration command is intentionally forward-only.

For a schema correction:

1. create a new migration;
2. verify it against an appropriate database or integration test;
3. run `pnpm db:migrate:production` once;
4. deploy the compatible API;
5. verify health and run `pnpm smoke:production`.

A forward fix is not a rollback. Document which recovery path was used.

## After recovery

Confirm all of the following:

- the web root renders;
- `/api/health` returns the expected contract;
- `pnpm smoke:production` passes or any reported degraded provider state is understood;
- no startup or request-error loop remains in Render or Vercel logs;
- the deployed environment and database target are the intended production ones;
- the incident record contains no secrets or raw sensitive provider data.
