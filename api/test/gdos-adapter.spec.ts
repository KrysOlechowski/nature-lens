import { describe, expect, it, vi } from "vitest";
import { ExternalHttpClient } from "../src/external-http/external-http-client.service.js";
import { createExternalHttpPolicy } from "../src/external-http/external-http-policy.js";
import type { ExternalHttpFetch } from "../src/external-http/external-http.tokens.js";
import {
  GDOS_PROTECTED_AREA_FETCH_LIMIT,
  GDOS_PROTECTED_AREA_TYPE_NAMES,
} from "../src/gdos/gdos.constants.js";
import { GdosAdapter } from "../src/gdos/gdos.adapter.js";
import { ProviderError } from "../src/provider-errors/provider.error.js";

const WFS_URL = "https://sdi.gdos.gov.pl/wfs";

function createAdapter() {
  const request = vi.fn<ExternalHttpFetch>();
  const policy = createExternalHttpPolicy({
    timeoutMs: 5_000,
    maxAttempts: 2,
  });
  const externalHttpClient = new ExternalHttpClient(
    request,
    vi.fn().mockResolvedValue(undefined),
    () => 0.5,
  );
  const getJson = vi.spyOn(externalHttpClient, "getJson");

  return {
    adapter: new GdosAdapter(externalHttpClient, policy, WFS_URL),
    getJson,
    policy,
  };
}

describe("GdosAdapter", () => {
  it("requests the supported polygon layers for an explicit WGS84 bbox", async () => {
    const { adapter, getJson, policy } = createAdapter();
    getJson.mockResolvedValue({ type: "FeatureCollection", features: [] });

    await adapter.getWithinBoundingBox({
      west: 20,
      south: 49,
      east: 22,
      north: 51,
    });

    expect(getJson).toHaveBeenCalledOnce();
    const request = getJson.mock.calls[0]?.[0];

    expect(request?.policy).toBe(policy);

    expect(request?.provider).toBe("GDOŚ");
    expect(request?.url.origin).toBe("https://sdi.gdos.gov.pl");
    expect(request?.url.pathname).toBe("/wfs");
    expect(Object.fromEntries(request?.url.searchParams ?? [])).toEqual({
      bbox: "20,49,22,51,EPSG:4326",
      maxFeatures: String(GDOS_PROTECTED_AREA_FETCH_LIMIT),
      outputFormat: "application/json",
      request: "GetFeature",
      service: "WFS",
      srsName: "EPSG:4326",
      typeName: GDOS_PROTECTED_AREA_TYPE_NAMES.join(","),
      version: "1.0.0",
    });
  });

  it("maps an invalid provider contract to a controlled provider error", async () => {
    const { adapter, getJson } = createAdapter();
    getJson.mockResolvedValue({ type: "FeatureCollection", features: null });

    await expect(
      adapter.getWithinBoundingBox({
        west: 20,
        south: 49,
        east: 22,
        north: 51,
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ProviderError>>({
        kind: "invalid-response",
        provider: "GDOŚ",
      }),
    );
  });
});
