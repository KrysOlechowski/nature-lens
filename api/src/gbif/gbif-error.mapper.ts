import { ExternalHttpError } from "../external-http/external-http.error.js";
import { ProviderError } from "../provider-errors/provider.error.js";
import { GBIFIntegrationError } from "./gbif-integration.error.js";

export function throwGBIFProviderError(error: unknown): never {
  if (error instanceof ProviderError) {
    throw error;
  }

  if (error instanceof GBIFIntegrationError) {
    throw new ProviderError("GBIF returned an invalid contract", {
      cause: error,
      kind: "invalid-response",
      provider: error.provider,
    });
  }

  if (error instanceof ExternalHttpError) {
    throw mapExternalHttpError(error);
  }

  throw error;
}

function mapExternalHttpError(error: ExternalHttpError): ProviderError {
  const commonOptions = {
    cause: error,
    provider: error.provider,
    ...(error.status === undefined ? {} : { upstreamStatus: error.status }),
  };

  if (error.kind === "timeout") {
    return new ProviderError(`${error.provider} timed out`, {
      ...commonOptions,
      kind: "timeout",
    });
  }

  if (error.kind === "invalid-response") {
    return new ProviderError(`${error.provider} returned an invalid response`, {
      ...commonOptions,
      kind: "invalid-response",
    });
  }

  if (error.kind === "http" && error.status === 429) {
    return new ProviderError(`${error.provider} rate limit was reached`, {
      ...commonOptions,
      kind: "rate-limited",
    });
  }

  if (
    error.kind === "http" &&
    error.status !== undefined &&
    error.status >= 400 &&
    error.status < 500
  ) {
    return new ProviderError(`${error.provider} rejected the request`, {
      ...commonOptions,
      kind: "request-rejected",
    });
  }

  return new ProviderError(`${error.provider} is unavailable`, {
    ...commonOptions,
    kind: "unavailable",
  });
}
