import { describe, expect, it } from "vitest";
import { z } from "zod";
import { NominatimIntegrationError } from "../src/nominatim/nominatim-integration.error.js";
import {
  parseNominatimLookupResponse,
  parseNominatimSearchResponse,
} from "../src/nominatim/nominatim-response.schema.js";

describe("parseNominatimSearchResponse", () => {
  it("validates the provider fields used by place mapping", () => {
    const response = [
      {
        boundingbox: ["49.9922443", "50.0828961", "20.2068085", "20.4553447"],
        category: "landuse",
        display_name:
          "Puszcza Niepołomicka, Wieliczka County, Lesser Poland Voivodeship, 30-207, Poland",
        importance: 0.3586565232418998,
        lat: "50.0375577",
        licence: "Data © OpenStreetMap contributors, ODbL 1.0",
        lon: "20.3379565",
        name: "Puszcza Niepołomicka",
        osm_id: 61493,
        osm_type: "relation",
        place_id: 180304441,
        type: "forest",
      },
    ];

    expect(parseNominatimSearchResponse(response)).toEqual([
      {
        boundingbox: [49.9922443, 50.0828961, 20.2068085, 20.4553447],
        category: "landuse",
        display_name:
          "Puszcza Niepołomicka, Wieliczka County, Lesser Poland Voivodeship, 30-207, Poland",
        lat: 50.0375577,
        lon: 20.3379565,
        name: "Puszcza Niepołomicka",
        osm_id: 61493,
        osm_type: "relation",
        type: "forest",
      },
    ]);
  });

  it("accepts a valid result without an OSM identity for later filtering", () => {
    const response = [
      {
        boundingbox: ["50", "50", "20", "20"],
        category: "place",
        display_name: "Example postcode, Poland",
        lat: "50",
        lon: "20",
        type: "postcode",
      },
    ];

    expect(parseNominatimSearchResponse(response)).toEqual([
      {
        boundingbox: [50, 50, 20, 20],
        category: "place",
        display_name: "Example postcode, Poland",
        lat: 50,
        lon: 20,
        type: "postcode",
      },
    ]);
  });

  it.each([
    [
      "a coordinate outside WGS84 bounds",
      [
        {
          boundingbox: ["50", "51", "20", "21"],
          category: "place",
          display_name: "Invalid place",
          lat: "91",
          lon: "20",
          osm_id: 1,
          osm_type: "node",
          type: "village",
        },
      ],
    ],
    [
      "an unordered bounding box",
      [
        {
          boundingbox: ["51", "50", "20", "21"],
          category: "place",
          display_name: "Invalid place",
          lat: "50",
          lon: "20",
          osm_id: 1,
          osm_type: "way",
          type: "village",
        },
      ],
    ],
    ["a response that is not an array", { results: [] }],
  ])(
    "reports %s as a controlled integration error",
    (_description, response) => {
      expect(() => parseNominatimSearchResponse(response)).toThrowError(
        expect.objectContaining<Partial<NominatimIntegrationError>>({
          cause: expect.any(z.ZodError),
          kind: "invalid-response",
          message:
            "OpenStreetMap Nominatim returned an invalid search response",
          provider: "OpenStreetMap Nominatim",
        }),
      );
    },
  );
});

describe("parseNominatimLookupResponse", () => {
  it("preserves normalized country evidence for lookup filtering", () => {
    const response = [
      {
        address: {
          country: "Poland",
          country_code: " PL ",
        },
        boundingbox: ["49.9", "50.1", "20.2", "20.5"],
        category: "landuse",
        display_name: "Puszcza Niepołomicka, Poland",
        lat: "50.03",
        lon: "20.33",
        osm_id: 61493,
        osm_type: "relation",
        type: "forest",
      },
    ];

    expect(parseNominatimLookupResponse(response)).toEqual([
      expect.objectContaining({
        address: { country_code: "pl" },
        osm_id: 61493,
        osm_type: "relation",
      }),
    ]);
  });

  it("allows missing country evidence for later not-found handling", () => {
    const response = [
      {
        boundingbox: ["49.9", "50.1", "20.2", "20.5"],
        category: "landuse",
        display_name: "Unverified place",
        lat: "50.03",
        lon: "20.33",
        osm_id: 61493,
        osm_type: "relation",
        type: "forest",
      },
    ];

    expect(parseNominatimLookupResponse(response)).toEqual([
      expect.not.objectContaining({ address: expect.anything() }),
    ]);
  });
});
