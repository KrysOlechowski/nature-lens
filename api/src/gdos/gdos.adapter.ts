import { Inject, Injectable } from "@nestjs/common";
import { ExternalHttpClient } from "../external-http/external-http-client.service.js";
import type { ExternalHttpPolicy } from "../external-http/external-http-policy.js";
import type { ProtectedAreasProvider } from "../protected-areas/protected-areas-provider.contract.js";
import type {
  ProtectedAreaBoundingBox,
  ProtectedAreaProviderResult,
} from "../protected-areas/protected-area.model.js";
import {
  GDOS_PROTECTED_AREA_FETCH_LIMIT,
  GDOS_PROTECTED_AREA_TYPE_NAMES,
  GDOS_PROVIDER,
} from "./gdos.constants.js";
import { throwGdosProviderError } from "./gdos-error.mapper.js";
import { parseGdosProtectedAreasResponse } from "./gdos-response.schema.js";
import { GDOS_HTTP_POLICY, GDOS_WFS_URL } from "./gdos.tokens.js";

@Injectable()
export class GdosAdapter implements ProtectedAreasProvider {
  readonly providerName = GDOS_PROVIDER;

  constructor(
    private readonly externalHttpClient: ExternalHttpClient,
    @Inject(GDOS_HTTP_POLICY)
    private readonly httpPolicy: ExternalHttpPolicy,
    @Inject(GDOS_WFS_URL) private readonly wfsUrl: string,
  ) {}

  async getWithinBoundingBox({
    west,
    south,
    east,
    north,
  }: ProtectedAreaBoundingBox): Promise<ProtectedAreaProviderResult> {
    const url = new URL(this.wfsUrl);
    url.searchParams.set("service", "WFS");
    url.searchParams.set("version", "1.0.0");
    url.searchParams.set("request", "GetFeature");
    url.searchParams.set("typeName", GDOS_PROTECTED_AREA_TYPE_NAMES.join(","));
    url.searchParams.set("srsName", "EPSG:4326");
    url.searchParams.set("bbox", `${west},${south},${east},${north},EPSG:4326`);
    url.searchParams.set("outputFormat", "application/json");
    url.searchParams.set(
      "maxFeatures",
      String(GDOS_PROTECTED_AREA_FETCH_LIMIT),
    );

    try {
      const response = await this.externalHttpClient.getJson({
        policy: this.httpPolicy,
        provider: GDOS_PROVIDER,
        url,
      });

      return parseGdosProtectedAreasResponse(response);
    } catch (error) {
      throwGdosProviderError(error);
    }
  }
}
