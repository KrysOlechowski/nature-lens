import { createServer } from "node:http";

const host = "127.0.0.1";
const port = 3101;
const webOrigin = "http://127.0.0.1:3100";

const species = {
  id: "1",
  scientificName: "Bison bonasus",
  commonName: "European bison",
  displayName: "European bison",
  taxonomy: { rank: "species" },
  source: { provider: "iNaturalist", externalId: "4369" },
};

const place = {
  id: "osm:relation:123",
  slug: "bialowieza-national-park",
  label: "Białowieża National Park, Poland",
  type: "natural-area",
  center: { longitude: 23.85, latitude: 52.75 },
  bbox: { west: 23.3, south: 52.5, east: 24.1, north: 52.95 },
};

const observationProperties = {
  observedOn: "2026-05-12",
  observedAt: "2026-05-12T08:30:00Z",
  accuracyMeters: 25,
  locationPrecision: "approximate",
  locationPrivacy: "open",
  sources: [
    {
      provider: "iNaturalist",
      externalId: "9001",
      url: "https://www.inaturalist.org/observations/9001",
      license: { code: "CC-BY-NC", url: null },
      dataset: null,
    },
  ],
};

const speciesObservationCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [23.8, 52.7] },
      properties: observationProperties,
    },
  ],
  metadata: { datasetScope: "locally-synchronized", truncated: false },
};

const placeObservationCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [23.8, 52.7] },
      properties: {
        ...observationProperties,
        species: {
          id: species.id,
          scientificName: species.scientificName,
          displayName: species.displayName,
        },
      },
    },
  ],
  species: {
    items: [
      {
        id: species.id,
        scientificName: species.scientificName,
        displayName: species.displayName,
        observationCount: 1,
      },
    ],
    returnedCount: 1,
    totalCount: 1,
    truncated: false,
  },
  metadata: {
    datasetScope: "locally-synchronized",
    returnedObservationCount: 1,
    totalObservationCount: 1,
    truncated: false,
  },
};

const observationPage = {
  totalResults: 1,
  page: 1,
  perPage: 200,
  results: [
    {
      observedOn: observationProperties.observedOn,
      observedAt: observationProperties.observedAt,
      location: {
        latitude: 52.7,
        longitude: 23.8,
        accuracyMeters: observationProperties.accuracyMeters,
        precision: observationProperties.locationPrecision,
      },
      locationPrivacy: observationProperties.locationPrivacy,
      source: observationProperties.sources[0],
    },
  ],
  metadata: {
    servedFrom: "provider-sync",
    freshness: "fresh",
    lastSuccessfulSyncAt: "2026-05-12T09:00:00.000Z",
    providers: [{ provider: "inaturalist", status: "available" }],
  },
};

const seasonality = {
  months: Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    count: index === 4 ? 1 : 0,
  })),
  years: [{ year: 2026, count: 1 }],
  undatedCount: 0,
  metadata: { datasetScope: "locally-synchronized" },
};

const mapStyle = {
  version: 8,
  name: "Nature Lens E2E",
  sources: {},
  layers: [],
};

let unexpectedRequests = [];

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": webOrigin,
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
}

function sendEmpty(response, statusCode = 204) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": webOrigin,
  });
  response.end();
}

function rejectUnexpected(request, response, url, reason) {
  const description = `${request.method} ${url.pathname}${url.search} — ${reason}`;

  unexpectedRequests.push(description);
  sendJson(response, 501, {
    error: "The deterministic E2E mock does not support this request",
    request: description,
  });
}

function hasExactSearchParams(url, expectedEntries) {
  const actualEntries = [...url.searchParams.entries()].sort();
  const expected = [...expectedEntries].sort();

  return JSON.stringify(actualEntries) === JSON.stringify(expected);
}

function hasValidBoundingBox(value) {
  if (value === null) {
    return false;
  }

  const coordinates = value.split(",").map(Number);

  return (
    coordinates.length === 4 &&
    coordinates.every(Number.isFinite) &&
    coordinates[0] < coordinates[2] &&
    coordinates[1] < coordinates[3]
  );
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://${host}:${port}`);
  const decodedPathname = decodeURIComponent(url.pathname);

  if (request.method === "GET" && url.pathname === "/__health") {
    sendEmpty(response);
    return;
  }

  if (request.method === "POST" && url.pathname === "/__mock/reset") {
    unexpectedRequests = [];
    sendEmpty(response);
    return;
  }

  if (
    request.method === "GET" &&
    url.pathname === "/__mock/unexpected-requests"
  ) {
    sendJson(response, 200, unexpectedRequests);
    return;
  }

  if (request.method === "GET" && url.pathname === "/map/style.json") {
    sendJson(response, 200, mapStyle);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/species/search") {
    const query = url.searchParams.get("q");

    if (!hasExactSearchParams(url, [["q", query ?? ""]])) {
      rejectUnexpected(request, response, url, "unexpected search parameters");
      return;
    }

    if (query === "European bison") {
      sendJson(response, 200, [species]);
      return;
    }

    if (query === "Białowieża") {
      sendJson(response, 200, []);
      return;
    }

    rejectUnexpected(request, response, url, "unsupported species query");
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/places/search") {
    const query = url.searchParams.get("q");

    if (!hasExactSearchParams(url, [["q", query ?? ""]])) {
      rejectUnexpected(request, response, url, "unexpected search parameters");
      return;
    }

    if (query === "European bison") {
      sendJson(response, 200, []);
      return;
    }

    if (query === "Białowieża") {
      sendJson(response, 200, [place]);
      return;
    }

    rejectUnexpected(request, response, url, "unsupported place query");
    return;
  }

  if (request.method === "GET" && decodedPathname === "/api/species/1") {
    if (url.search !== "") {
      rejectUnexpected(request, response, url, "unexpected species parameters");
      return;
    }

    const {
      commonName: _commonName,
      source: _source,
      ...speciesDetail
    } = species;
    sendJson(response, 200, speciesDetail);
    return;
  }

  if (
    request.method === "GET" &&
    decodedPathname === "/api/species/1/observations"
  ) {
    if (
      hasExactSearchParams(url, [
        ["page", "1"],
        ["perPage", "200"],
      ])
    ) {
      sendJson(response, 200, observationPage);
      return;
    }

    if (
      url.searchParams.get("limit") === "1000" &&
      hasValidBoundingBox(url.searchParams.get("bbox")) &&
      url.searchParams.size === 2
    ) {
      sendJson(response, 200, speciesObservationCollection);
      return;
    }

    rejectUnexpected(
      request,
      response,
      url,
      "unsupported species observation query",
    );
    return;
  }

  if (
    request.method === "GET" &&
    decodedPathname === "/api/species/1/observation-seasonality"
  ) {
    if (url.search !== "") {
      rejectUnexpected(
        request,
        response,
        url,
        "unexpected seasonality parameters",
      );
      return;
    }

    sendJson(response, 200, seasonality);
    return;
  }

  if (
    request.method === "GET" &&
    decodedPathname === `/api/places/${place.id}`
  ) {
    if (url.search !== "") {
      rejectUnexpected(request, response, url, "unexpected place parameters");
      return;
    }

    sendJson(response, 200, place);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/weather/current") {
    if (
      !hasExactSearchParams(url, [
        ["latitude", String(place.center.latitude)],
        ["longitude", String(place.center.longitude)],
      ])
    ) {
      rejectUnexpected(request, response, url, "unexpected weather parameters");
      return;
    }

    sendJson(response, 200, {
      validAt: "2026-05-12T09:00:00.000Z",
      temperatureCelsius: 12.5,
      precipitationMillimeters: 0,
      windSpeedKilometersPerHour: 7.2,
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/observations") {
    if (
      url.searchParams.get("limit") === "1000" &&
      url.searchParams.get("speciesLimit") === "25" &&
      hasValidBoundingBox(url.searchParams.get("bbox")) &&
      url.searchParams.size === 3
    ) {
      sendJson(response, 200, placeObservationCollection);
      return;
    }

    rejectUnexpected(
      request,
      response,
      url,
      "unsupported spatial observation query",
    );
    return;
  }

  rejectUnexpected(request, response, url, "unsupported endpoint");
});

server.listen(port, host);

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
