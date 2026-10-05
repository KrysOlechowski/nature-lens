import { type ArgumentsHost, Logger } from "@nestjs/common";
import { FILTER_CATCH_EXCEPTIONS } from "@nestjs/common/constants";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderExceptionFilter } from "../src/provider-errors/provider-exception.filter.js";
import { ProviderError } from "../src/provider-errors/provider.error.js";

describe("ProviderExceptionFilter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
  });

  it.each([
    ["timeout", 504, "PROVIDER_TIMEOUT", "The external provider timed out"],
    [
      "rate-limited",
      503,
      "PROVIDER_RATE_LIMITED",
      "The external provider is temporarily rate limited",
    ],
    [
      "unavailable",
      503,
      "PROVIDER_UNAVAILABLE",
      "The external provider is currently unavailable",
    ],
    [
      "invalid-response",
      502,
      "PROVIDER_INVALID_RESPONSE",
      "The external provider returned an invalid response",
    ],
    [
      "request-rejected",
      502,
      "PROVIDER_REQUEST_REJECTED",
      "The external provider rejected the request",
    ],
  ] as const)(
    "maps %s to a stable HTTP response",
    (kind, statusCode, code, message) => {
      const { host, json, status } = createHttpHost();
      const filter = new ProviderExceptionFilter();
      const cause = new Error("Sensitive transport detail");
      const error = new ProviderError("Internal provider detail", {
        cause,
        kind,
        provider: "iNaturalist",
        upstreamStatus: 503,
      });

      filter.catch(error, host);

      expect(status).toHaveBeenCalledWith(statusCode);
      expect(json).toHaveBeenCalledWith({
        statusCode,
        code,
        message,
        provider: "iNaturalist",
      });
      expect(json).not.toHaveBeenCalledWith(expect.objectContaining({ cause }));
      expect(json).not.toHaveBeenCalledWith(
        expect.objectContaining({ message: error.message }),
      );
      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          `provider=iNaturalist kind=${kind} upstreamStatus=503 responseStatus=${statusCode} code=${code}`,
        ),
      );
    },
  );

  it("is registered to catch only controlled provider errors", () => {
    const caughtExceptions = Reflect.getMetadata(
      FILTER_CATCH_EXCEPTIONS,
      ProviderExceptionFilter,
    ) as unknown[];

    expect(caughtExceptions).toEqual([ProviderError]);
    expect(new Error("Uncontrolled")).not.toBeInstanceOf(
      caughtExceptions[0] as typeof ProviderError,
    );
  });
});

function createHttpHost(): {
  host: ArgumentsHost;
  json: ReturnType<typeof vi.fn>;
  status: ReturnType<typeof vi.fn>;
} {
  const json = vi.fn();
  const response = {
    json,
    status: vi.fn(),
  };
  response.status.mockReturnValue(response);

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
    }),
  } as ArgumentsHost;

  return { host, json, status: response.status };
}
