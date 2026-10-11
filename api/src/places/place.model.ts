export const PLACE_TYPES = [
  "city",
  "town",
  "village",
  "administrative-area",
  "natural-area",
  "other",
] as const;

export type PlaceType = (typeof PLACE_TYPES)[number];

export interface PlaceCenter {
  longitude: number;
  latitude: number;
}

export interface PlaceBoundingBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface Place {
  /**
   * An opaque identifier derived only from the provider namespace and the
   * provider's stable object identity. Consumers must not parse or construct it.
   */
  id: string;
  /** A human-readable, non-unique representation that is never an identity. */
  slug: string;
  label: string;
  type: PlaceType;
  /** A provider-supplied representative WGS84 point. */
  center: PlaceCenter;
  /** A provider-supplied WGS84 extent, or null when no reliable extent exists. */
  bbox: PlaceBoundingBox | null;
}
