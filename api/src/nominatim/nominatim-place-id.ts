export const OPEN_STREET_MAP_OBJECT_TYPES = [
  "node",
  "way",
  "relation",
] as const;

export type OpenStreetMapObjectType =
  (typeof OPEN_STREET_MAP_OBJECT_TYPES)[number];

export interface NominatimPlaceIdentity {
  osmId: number;
  osmType: OpenStreetMapObjectType;
}

const placeIdPattern = /^osm:(node|way|relation):([1-9]\d*)$/;

export function encodeNominatimPlaceId({
  osmId,
  osmType,
}: NominatimPlaceIdentity): string {
  return `osm:${osmType}:${osmId}`;
}

export function decodeNominatimPlaceId(
  placeId: string,
): NominatimPlaceIdentity | null {
  const match = placeIdPattern.exec(placeId);

  if (!match) {
    return null;
  }

  const osmType = match[1] as OpenStreetMapObjectType;
  const osmId = Number(match[2]);
  const identity = { osmId, osmType };

  if (
    !Number.isSafeInteger(osmId) ||
    encodeNominatimPlaceId(identity) !== placeId
  ) {
    return null;
  }

  return identity;
}
