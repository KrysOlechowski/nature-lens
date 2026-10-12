import type {
  ProtectedAreaBoundingBox,
  ProtectedAreaProviderResult,
} from "./protected-area.model.js";

export interface ProtectedAreasProvider {
  readonly providerName: string;

  getWithinBoundingBox(
    boundingBox: ProtectedAreaBoundingBox,
  ): Promise<ProtectedAreaProviderResult>;
}
