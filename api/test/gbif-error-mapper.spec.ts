import { describe, expect, it } from "vitest";
import { ExternalHttpError } from "../src/external-http/external-http.error.js";
import { throwGBIFProviderError } from "../src/gbif/gbif-error.mapper.js";
import { GBIFIntegrationError } from "../src/gbif/gbif-integration.error.js";
import { ProviderError } from "../src/provider-errors/provider.error.js";

describe("throwGBIFProviderError", () => {
  it.each([
    ["timeout", "timeout", undefined, "timeout"],
    ["network failure", "network", undefined, "unavailable"],
    ["rate limit", "http", 429, "rate-limited"],
    ["upstream server failure", "http", 503, "unavailable"],
    ["unexpected upstream rejection", "http", 404, "request-rejected"],
    ["malformed JSON", "invalid-response", 200, "invalid-response"],
  ] as const)(
    "maps a transport %s",
    (_description, externalKind, upstreamStatus, providerKind) => {
      const externalError = new ExternalHttpError("Transport failed", {
        kind: externalKind,
        provider: "GBIF",
        ...(upstreamStatus === undefined ? {} : { status: upstreamStatus }),
      });

      expect(() => throwGBIFProviderError(externalError)).toThrowError(
        expect.objectContaining<Partial<ProviderError>>({
          cause: externalError,
          kind: providerKind,
          provider: "GBIF",
          upstreamStatus,
        }),
      );
    },
  );

  it("maps a provider contract failure to an invalid response", () => {
    const integrationError = new GBIFIntegrationError("Invalid contract");

    expect(() => throwGBIFProviderError(integrationError)).toThrowError(
      expect.objectContaining<Partial<ProviderError>>({
        cause: integrationError,
        kind: "invalid-response",
        provider: "GBIF",
      }),
    );
  });

  it("does not translate an uncontrolled error", () => {
    const uncontrolledError = new Error("Unexpected application failure");

    expect(() => throwGBIFProviderError(uncontrolledError)).toThrowError(
      uncontrolledError,
    );
  });
});
