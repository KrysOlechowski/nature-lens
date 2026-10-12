import { z } from "zod";
import type {
  ProtectedArea,
  ProtectedAreaCategory,
} from "../protected-areas/protected-area.model.js";
import {
  GDOS_PROTECTED_AREA_FETCH_LIMIT,
  MAX_PROTECTED_AREAS_PER_VIEWPORT,
} from "./gdos.constants.js";
import { GdosIntegrationError } from "./gdos-integration.error.js";

const layerNames = [
  "ObszaryChronionegoKrajobrazu",
  "ObszarySpecjalnejOchrony",
  "ParkiKrajobrazowe",
  "ParkiNarodowe",
  "PomnikiPrzyrodyPowierzchniowe",
  "Rezerwaty",
  "SpecjalneObszaryOchrony",
  "StanowiskaDokumentacyjne",
  "UzytkiEkologiczne",
  "ZespolyPrzyrodniczoKrajobrazowe",
] as const;
type GdosProtectedAreaLayerName = (typeof layerNames)[number];

const layerCategories = {
  ObszaryChronionegoKrajobrazu: "protected-landscape-area",
  ObszarySpecjalnejOchrony: "natura-2000-bird",
  ParkiKrajobrazowe: "landscape-park",
  ParkiNarodowe: "national-park",
  PomnikiPrzyrodyPowierzchniowe: "natural-monument-area",
  Rezerwaty: "nature-reserve",
  SpecjalneObszaryOchrony: "natura-2000-habitat",
  StanowiskaDokumentacyjne: "documentation-site",
  UzytkiEkologiczne: "ecological-site",
  ZespolyPrzyrodniczoKrajobrazowe: "landscape-nature-complex",
} as const satisfies Record<GdosProtectedAreaLayerName, ProtectedAreaCategory>;

const layerNameSchema = z.enum(layerNames);
const longitudeSchema = z.number().finite().min(-180).max(180);
const latitudeSchema = z.number().finite().min(-90).max(90);
const positionSchema = z.tuple([longitudeSchema, latitudeSchema]);
const linearRingSchema = z.array(positionSchema).min(4);
const polygonCoordinatesSchema = z.array(linearRingSchema).min(1);
const geometrySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("Polygon"),
    coordinates: polygonCoordinatesSchema,
  }),
  z.object({
    type: z.literal("MultiPolygon"),
    coordinates: z.array(polygonCoordinatesSchema).min(1),
  }),
]);
const featureSchema = z.object({
  type: z.literal("Feature"),
  id: z.string().min(1),
  geometry: geometrySchema,
  properties: z.object({
    nazwa: z.string().trim().min(1),
    kodinspire: z.string().trim().min(1),
  }),
});
const featureCollectionSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(featureSchema).max(GDOS_PROTECTED_AREA_FETCH_LIMIT),
});

export interface ParsedGdosProtectedAreas {
  areas: ProtectedArea[];
  truncated: boolean;
}

export function parseGdosProtectedAreasResponse(
  response: unknown,
): ParsedGdosProtectedAreas {
  const result = featureCollectionSchema.safeParse(response);

  if (!result.success) {
    throw new GdosIntegrationError(
      "GDOŚ returned an invalid protected areas response",
      { cause: result.error },
    );
  }

  const mappedAreas = result.data.features.map((feature) => {
    const layerNameResult = layerNameSchema.safeParse(
      feature.id.split(".", 1)[0],
    );

    if (!layerNameResult.success) {
      throw new GdosIntegrationError(
        "GDOŚ returned a protected area from an unexpected layer",
        { cause: layerNameResult.error },
      );
    }

    return {
      category: layerCategories[layerNameResult.data],
      geometry: feature.geometry,
      inspireCode: feature.properties.kodinspire,
      name: feature.properties.nazwa,
    };
  });

  return {
    areas: mappedAreas.slice(0, MAX_PROTECTED_AREAS_PER_VIEWPORT),
    truncated: mappedAreas.length > MAX_PROTECTED_AREAS_PER_VIEWPORT,
  };
}
