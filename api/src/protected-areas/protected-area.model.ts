export interface ProtectedAreaBoundingBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export type ProtectedAreaCategory =
  | "documentation-site"
  | "ecological-site"
  | "landscape-park"
  | "landscape-nature-complex"
  | "national-park"
  | "natural-monument-area"
  | "natura-2000-bird"
  | "natura-2000-habitat"
  | "nature-reserve"
  | "protected-landscape-area";

export type ProtectedAreaGeometry =
  | {
      type: "Polygon";
      coordinates: [longitude: number, latitude: number][][];
    }
  | {
      type: "MultiPolygon";
      coordinates: [longitude: number, latitude: number][][][];
    };

export interface ProtectedArea {
  category: ProtectedAreaCategory;
  geometry: ProtectedAreaGeometry;
  inspireCode: string;
  name: string;
}

export interface ProtectedAreaProviderResult {
  areas: ProtectedArea[];
  truncated: boolean;
}

export interface ProtectedAreaFeature {
  type: "Feature";
  geometry: ProtectedAreaGeometry;
  properties: {
    category: ProtectedAreaCategory;
    inspireCode: string;
    name: string;
  };
}

export interface ProtectedAreaFeatureCollection {
  type: "FeatureCollection";
  features: ProtectedAreaFeature[];
  metadata: {
    attribution: "General Directorate for Environmental Protection (GDOŚ)";
    geometryPurpose: "display-simplified";
    returnedAreaCount: number;
    sourceUrl: "https://www.gov.pl/web/gdos/dostep-do-danych-geoprzestrzennych";
    truncated: boolean;
  };
}
