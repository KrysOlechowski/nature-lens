import { describe, expect, it } from "vitest";
import {
  decodeNominatimPlaceId,
  encodeNominatimPlaceId,
} from "../src/nominatim/nominatim-place-id.js";

describe("Nominatim place ID codec", () => {
  it("round-trips a stable OSM object identity", () => {
    const identity = {
      osmId: 61493,
      osmType: "relation" as const,
    };

    const placeId = encodeNominatimPlaceId(identity);

    expect(placeId).toBe("osm:relation:61493");
    expect(decodeNominatimPlaceId(placeId)).toEqual(identity);
  });

  it.each([
    "",
    "inaturalist:relation:61493",
    "osm:area:61493",
    "osm:relation:0",
    "osm:relation:061493",
    "osm:relation:9007199254740992",
  ])("rejects unsupported or non-canonical identity %j", (placeId) => {
    expect(decodeNominatimPlaceId(placeId)).toBeNull();
  });
});
