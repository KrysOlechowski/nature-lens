const DEFAULT_WEB_URL = "https://nature-lens-poland.vercel.app";
const DEFAULT_API_URL = "https://nature-lens-api.onrender.com";
const DEFAULT_SPECIES_QUERY = "Bison bonasus";
const POLAND_BOUNDING_BOX = "14.12,49,24.15,54.84";

const stageTimeouts = {
  WEB: 30_000,
  HEALTH: 10_000,
  SPECIES_SEARCH: 25_000,
  OBSERVATION_SYNC: 35_000,
  POSTGIS_BBOX: 15_000,
};

class SmokeFailure extends Error {
  constructor(stage, reason, status) {
    super(reason);
    this.name = "SmokeFailure";
    this.stage = stage;
    this.status = status;
  }
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function readBaseUrl(variableName, fallback) {
  const value = process.env[variableName]?.trim() || fallback;

  try {
    const url = new URL(value);

    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash
    ) {
      throw new Error();
    }

    return url.origin;
  } catch {
    throw new SmokeFailure(
      "CONFIG",
      `${variableName} must be an HTTP(S) origin without credentials, path, query, or fragment`,
    );
  }
}

function readSpeciesQuery() {
  const query =
    process.env.SMOKE_SPECIES_QUERY?.trim() || DEFAULT_SPECIES_QUERY;

  if (query.length > 100) {
    throw new SmokeFailure(
      "CONFIG",
      "SMOKE_SPECIES_QUERY must be no longer than 100 characters",
    );
  }

  return query;
}

function readTimeoutOverride() {
  const rawTimeout = process.env.SMOKE_TIMEOUT_MS?.trim();

  if (!rawTimeout) {
    return undefined;
  }

  const timeout = Number(rawTimeout);

  if (!Number.isInteger(timeout) || timeout < 1_000 || timeout > 120_000) {
    throw new SmokeFailure(
      "CONFIG",
      "SMOKE_TIMEOUT_MS must be an integer between 1000 and 120000",
    );
  }

  return timeout;
}

function timeoutFor(stage, override) {
  return override ?? stageTimeouts[stage];
}

async function request(stage, url, timeoutMs) {
  let response;

  try {
    response = await fetch(url, {
      headers: { Accept: "application/json, text/html;q=0.9" },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const reason =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError")
        ? `request timed out after ${timeoutMs} ms`
        : "request failed before receiving an HTTP response";

    throw new SmokeFailure(stage, reason);
  }

  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new SmokeFailure(stage, "unexpected HTTP response", response.status);
  }

  return response;
}

async function readText(stage, response) {
  try {
    return await response.text();
  } catch {
    throw new SmokeFailure(
      stage,
      "could not read the response body",
      response.status,
    );
  }
}

async function readJson(stage, response) {
  const body = await readText(stage, response);

  try {
    return JSON.parse(body);
  } catch {
    throw new SmokeFailure(
      stage,
      "response body was not valid JSON",
      response.status,
    );
  }
}

function requireContract(condition, stage, reason, status) {
  if (!condition) {
    throw new SmokeFailure(stage, reason, status);
  }
}

async function checkWeb(config) {
  const stage = "WEB";
  const url = new URL("/", config.webUrl);
  url.searchParams.set("q", config.speciesQuery);

  const response = await request(
    stage,
    url,
    timeoutFor(stage, config.timeoutOverride),
  );
  const html = await readText(stage, response);
  const speciesIds = [...html.matchAll(/href="\/species\/([1-9]\d*)"/g)].map(
    (match) => match[1],
  );

  requireContract(
    speciesIds.length > 0 &&
      html.includes("Scientific name") &&
      html.includes("Taxonomic rank"),
    stage,
    "the server-rendered search page did not contain species data from the API",
    response.status,
  );

  console.log(`${stage} OK`);
  return new Set(speciesIds);
}

async function checkHealth(config) {
  const stage = "HEALTH";
  const response = await request(
    stage,
    new URL("/api/health", config.apiUrl),
    timeoutFor(stage, config.timeoutOverride),
  );
  const payload = await readJson(stage, response);

  requireContract(
    isRecord(payload) && payload.status === "ok" && payload.version === "1",
    stage,
    "response did not match the health contract",
    response.status,
  );

  console.log(`${stage} OK`);
}

function isSpeciesSearchResult(value) {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    /^[1-9]\d*$/.test(value.id) &&
    isNonEmptyString(value.scientificName) &&
    (value.commonName === undefined || isNonEmptyString(value.commonName)) &&
    isNonEmptyString(value.displayName) &&
    isRecord(value.taxonomy) &&
    isNonEmptyString(value.taxonomy.rank) &&
    isRecord(value.source) &&
    isNonEmptyString(value.source.provider) &&
    isNonEmptyString(value.source.externalId)
  );
}

async function checkSpeciesSearch(config, webSpeciesIds) {
  const stage = "SPECIES_SEARCH";
  const url = new URL("/api/species/search", config.apiUrl);
  url.searchParams.set("q", config.speciesQuery);

  const response = await request(
    stage,
    url,
    timeoutFor(stage, config.timeoutOverride),
  );
  const payload = await readJson(stage, response);

  requireContract(
    Array.isArray(payload) && payload.length > 0,
    stage,
    "response did not contain any species results",
    response.status,
  );
  requireContract(
    payload.every(isSpeciesSearchResult),
    stage,
    "response did not match the species search contract",
    response.status,
  );

  const matchedSpecies = payload.find((species) =>
    webSpeciesIds.has(species.id),
  );

  requireContract(
    matchedSpecies !== undefined,
    stage,
    "API results did not include a species rendered by the web route",
    response.status,
  );

  console.log(`${stage} OK`);
  return matchedSpecies.id;
}

function validateProviderMetadata(metadata) {
  if (
    !isRecord(metadata) ||
    !["local-database", "provider-sync"].includes(metadata.servedFrom) ||
    !["fresh", "stale"].includes(metadata.freshness) ||
    !isNonEmptyString(metadata.lastSuccessfulSyncAt) ||
    !Array.isArray(metadata.providers) ||
    metadata.providers.length === 0
  ) {
    return false;
  }

  return metadata.providers.every(
    (provider) =>
      isRecord(provider) &&
      ["inaturalist", "gbif"].includes(provider.provider) &&
      ["available", "stale", "unavailable"].includes(provider.status),
  );
}

async function checkObservationSync(config, speciesId) {
  const stage = "OBSERVATION_SYNC";
  const url = new URL(
    `/api/species/${encodeURIComponent(speciesId)}/observations`,
    config.apiUrl,
  );
  url.searchParams.set("page", "1");
  url.searchParams.set("perPage", "200");

  const response = await request(
    stage,
    url,
    timeoutFor(stage, config.timeoutOverride),
  );
  const payload = await readJson(stage, response);

  requireContract(
    isRecord(payload) &&
      isNonNegativeInteger(payload.totalResults) &&
      payload.page === 1 &&
      payload.perPage === 200 &&
      Array.isArray(payload.results) &&
      validateProviderMetadata(payload.metadata),
    stage,
    "response did not match the observation synchronization contract",
    response.status,
  );

  const degradedProviders = payload.metadata.providers
    .filter((provider) => provider.status !== "available")
    .map((provider) => `${provider.provider} ${provider.status}`);

  if (payload.metadata.freshness === "stale") {
    degradedProviders.push("page stale");
  }

  const degraded = [...new Set(degradedProviders)];
  console.log(
    degraded.length === 0
      ? `${stage} OK`
      : `${stage} OK (degraded: ${degraded.join(", ")})`,
  );
}

function isGeoJsonFeature(value) {
  return (
    isRecord(value) &&
    value.type === "Feature" &&
    isRecord(value.geometry) &&
    value.geometry.type === "Point" &&
    Array.isArray(value.geometry.coordinates) &&
    value.geometry.coordinates.length === 2 &&
    value.geometry.coordinates.every(Number.isFinite) &&
    isRecord(value.properties)
  );
}

async function checkPostgisBoundingBox(config, speciesId) {
  const stage = "POSTGIS_BBOX";
  const url = new URL(
    `/api/species/${encodeURIComponent(speciesId)}/observations`,
    config.apiUrl,
  );
  url.searchParams.set("bbox", POLAND_BOUNDING_BOX);
  url.searchParams.set("limit", "1000");

  const response = await request(
    stage,
    url,
    timeoutFor(stage, config.timeoutOverride),
  );
  const payload = await readJson(stage, response);

  requireContract(
    isRecord(payload) &&
      payload.type === "FeatureCollection" &&
      Array.isArray(payload.features) &&
      payload.features.every(isGeoJsonFeature) &&
      isRecord(payload.metadata) &&
      payload.metadata.datasetScope === "locally-synchronized" &&
      typeof payload.metadata.truncated === "boolean",
    stage,
    "response did not match the observation GeoJSON contract",
    response.status,
  );

  console.log(`${stage} OK`);
}

async function main() {
  const timeoutOverride = readTimeoutOverride();
  const config = {
    webUrl: readBaseUrl("PRODUCTION_WEB_URL", DEFAULT_WEB_URL),
    apiUrl: readBaseUrl("PRODUCTION_API_URL", DEFAULT_API_URL),
    speciesQuery: readSpeciesQuery(),
    timeoutOverride,
  };

  const webSpeciesIds = await checkWeb(config);
  await checkHealth(config);
  const speciesId = await checkSpeciesSearch(config, webSpeciesIds);
  await checkObservationSync(config, speciesId);
  await checkPostgisBoundingBox(config, speciesId);
}

try {
  await main();
} catch (error) {
  if (error instanceof SmokeFailure) {
    const status = error.status === undefined ? "n/a" : error.status;
    console.error(`${error.stage} FAILED (HTTP ${status}): ${error.message}`);
  } else {
    console.error("SMOKE FAILED (HTTP n/a): unexpected internal error");
  }

  process.exitCode = 1;
}
