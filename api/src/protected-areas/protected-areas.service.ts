import { Inject, Injectable } from "@nestjs/common";
import type { ProtectedAreasProvider } from "./protected-areas-provider.contract.js";
import type {
  ProtectedAreaBoundingBox,
  ProtectedAreaFeatureCollection,
} from "./protected-area.model.js";
import { simplifyProtectedAreasForPresentation } from "./protected-area-simplifier.js";
import { PROTECTED_AREAS_PROVIDER } from "./protected-areas.tokens.js";

const attribution =
  "General Directorate for Environmental Protection (GDOŚ)" as const;
const sourceUrl =
  "https://www.gov.pl/web/gdos/dostep-do-danych-geoprzestrzennych" as const;

@Injectable()
export class ProtectedAreasService {
  constructor(
    @Inject(PROTECTED_AREAS_PROVIDER)
    private readonly provider: ProtectedAreasProvider,
  ) {}

  async getWithinBoundingBox(
    boundingBox: ProtectedAreaBoundingBox,
  ): Promise<ProtectedAreaFeatureCollection> {
    const result = await this.provider.getWithinBoundingBox(boundingBox);
    const presentationAreas = simplifyProtectedAreasForPresentation(
      result.areas,
      boundingBox,
    );

    return {
      type: "FeatureCollection",
      features: presentationAreas.map(({ geometry, ...properties }) => ({
        type: "Feature",
        geometry,
        properties,
      })),
      metadata: {
        attribution,
        geometryPurpose: "display-simplified",
        returnedAreaCount: presentationAreas.length,
        sourceUrl,
        truncated: result.truncated,
      },
    };
  }
}
