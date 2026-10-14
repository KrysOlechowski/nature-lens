import { Logger } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExternalHttpClient } from "../src/external-http/external-http-client.service.js";
import { ExternalHttpError } from "../src/external-http/external-http.error.js";
import {
  calculateExternalHttpOperationBudgetMs,
  createExternalHttpPolicy,
  type ExternalHttpPolicy,
} from "../src/external-http/external-http-policy.js";
import type {
  ExternalHttpDelay,
  ExternalHttpFetch,
  ExternalHttpRandom,
} from "../src/external-http/external-http.tokens.js";
import {
  getRequestContext,
  requestContextStorage,
} from "../src/logging/request-context.js";
import { NOMINATIM_HTTP_MAX_ATTEMPTS } from "../src/nominatim/nominatim.constants.js";

const DEFAULT_POLICY = createExternalHttpPolicy({
  timeoutMs: 5_000,
  maxAttempts: 2,
});
const TEST_URL = new URL(
  "https://api.inaturalist.org/v1/taxa?q=secret-search-term",
);

function createClient(
  request: ExternalHttpFetch,
  {
    delay = vi.fn<ExternalHttpDelay>().mockResolvedValue(undefined),
    random = vi.fn<ExternalHttpRandom>().mockReturnValue(0.5),
  }: {
    delay?: ExternalHttpDelay;
    random?: ExternalHttpRandom;
  } = {},
) {
  return {
    client: new ExternalHttpClient(request, delay, random),
    delay,
    random,
  };
}

function getJson(
  client: ExternalHttpClient,
  policy: ExternalHttpPolicy = DEFAULT_POLICY,
) {
  return client.getJson({
    policy,
    provider: "iNaturalist",
    url: TEST_URL,
  });
}

describe("ExternalHttpClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(Logger.prototype, "debug").mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
  });

  it("returns successful JSON without retrying", async () => {
    const request = vi
      .fn<ExternalHttpFetch>()
      .mockResolvedValue(Response.json({ results: [] }));
    const { client, delay } = createClient(request);

    await expect(getJson(client)).resolves.toEqual({ results: [] });

    expect(request).toHaveBeenCalledOnce();
    expect(delay).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledWith(TEST_URL, {
      headers: { accept: "application/json" },
      signal: expect.any(AbortSignal),
    });
    expect(Logger.prototype.log).toHaveBeenCalledWith(
      "External HTTP GET completed",
      expect.objectContaining({
        provider: "iNaturalist",
        endpoint: "/v1/taxa",
        status: 200,
        attempt: 1,
        maxAttempts: 2,
        latencyMs: expect.any(Number),
      }),
    );
    const logCalls = [
      ...vi.mocked(Logger.prototype.debug).mock.calls,
      ...vi.mocked(Logger.prototype.log).mock.calls,
      ...vi.mocked(Logger.prototype.warn).mock.calls,
    ];
    expect(JSON.stringify(logCalls)).not.toContain("secret-search-term");
  });

  it("sends an application-specific user agent when requested", async () => {
    const request = vi
      .fn<ExternalHttpFetch>()
      .mockResolvedValue(Response.json([]));
    const { client } = createClient(request);
    const url = new URL("https://nominatim.openstreetmap.org/search");

    await client.getJson({
      policy: createExternalHttpPolicy({
        timeoutMs: 5_000,
        maxAttempts: 1,
      }),
      provider: "OpenStreetMap Nominatim",
      url,
      userAgent: "  NatureLens/0.1  ",
    });

    expect(request).toHaveBeenCalledWith(url, {
      headers: {
        accept: "application/json",
        "user-agent": "NatureLens/0.1",
      },
      signal: expect.any(AbortSignal),
    });
  });

  it("rejects a blank user agent before making a request", async () => {
    const request = vi.fn<ExternalHttpFetch>();
    const { client } = createClient(request);

    await expect(
      client.getJson({
        policy: DEFAULT_POLICY,
        provider: "OpenStreetMap Nominatim",
        url: new URL("https://nominatim.openstreetmap.org/search"),
        userAgent: "   ",
      }),
    ).rejects.toThrowError(
      new TypeError("External HTTP user agent cannot be blank"),
    );
    expect(request).not.toHaveBeenCalled();
  });

  it("retries a network error and can recover", async () => {
    const requestIds: Array<string | undefined> = [];
    const request = vi
      .fn<ExternalHttpFetch>()
      .mockImplementationOnce(async () => {
        requestIds.push(getRequestContext()?.requestId);
        throw new TypeError("fetch failed");
      })
      .mockImplementationOnce(async () => {
        requestIds.push(getRequestContext()?.requestId);
        return Response.json({ results: [] });
      });
    const { client, delay } = createClient(request);

    await expect(
      requestContextStorage.run(
        { requestId: "d877f30e-22d8-43b6-bd59-e7eb1ab9ad4e" },
        () => getJson(client),
      ),
    ).resolves.toEqual({ results: [] });

    expect(request).toHaveBeenCalledTimes(2);
    expect(delay).toHaveBeenCalledOnce();
    expect(requestIds).toEqual([
      "d877f30e-22d8-43b6-bd59-e7eb1ab9ad4e",
      "d877f30e-22d8-43b6-bd59-e7eb1ab9ad4e",
    ]);
    expect(Logger.prototype.debug).toHaveBeenNthCalledWith(
      1,
      "External HTTP GET started",
      expect.objectContaining({
        provider: "iNaturalist",
        endpoint: "/v1/taxa",
        attempt: 1,
      }),
    );
    expect(Logger.prototype.debug).toHaveBeenNthCalledWith(
      2,
      "External HTTP GET started",
      expect.objectContaining({
        provider: "iNaturalist",
        endpoint: "/v1/taxa",
        attempt: 2,
      }),
    );
    expect(
      JSON.stringify(vi.mocked(Logger.prototype.debug).mock.calls),
    ).not.toContain("secret-search-term");
  });

  it("retries a timeout and can recover", async () => {
    const request = vi
      .fn<ExternalHttpFetch>()
      .mockRejectedValueOnce(new DOMException("Timed out", "TimeoutError"))
      .mockResolvedValueOnce(Response.json({ results: [] }));
    const { client, delay } = createClient(request);

    await expect(getJson(client)).resolves.toEqual({ results: [] });

    expect(request).toHaveBeenCalledTimes(2);
    expect(delay).toHaveBeenCalledOnce();
  });

  it.each([502, 503, 504])(
    "retries the selected transient HTTP %i status",
    async (status) => {
      const request = vi
        .fn<ExternalHttpFetch>()
        .mockResolvedValueOnce(new Response(null, { status }))
        .mockResolvedValueOnce(Response.json({ results: [] }));
      const { client, delay } = createClient(request);

      await expect(getJson(client)).resolves.toEqual({ results: [] });

      expect(request).toHaveBeenCalledTimes(2);
      expect(delay).toHaveBeenCalledOnce();
    },
  );

  it.each([400, 404, 429, 500])("does not retry HTTP %i", async (status) => {
    const request = vi
      .fn<ExternalHttpFetch>()
      .mockResolvedValue(new Response(null, { status }));
    const { client, delay } = createClient(request);

    await expect(getJson(client)).rejects.toMatchObject<
      Partial<ExternalHttpError>
    >({
      kind: "http",
      provider: "iNaturalist",
      status,
    });
    expect(request).toHaveBeenCalledOnce();
    expect(delay).not.toHaveBeenCalled();
  });

  it("does not retry invalid JSON", async () => {
    const request = vi
      .fn<ExternalHttpFetch>()
      .mockResolvedValue(new Response("not-json", { status: 200 }));
    const { client, delay } = createClient(request);

    await expect(getJson(client)).rejects.toMatchObject<
      Partial<ExternalHttpError>
    >({
      kind: "invalid-response",
      provider: "iNaturalist",
      status: 200,
    });
    expect(request).toHaveBeenCalledOnce();
    expect(delay).not.toHaveBeenCalled();
  });

  it("exhausts maxAttempts, including the first attempt", async () => {
    const request = vi
      .fn<ExternalHttpFetch>()
      .mockRejectedValue(new TypeError("fetch failed"));
    const policy = createExternalHttpPolicy({
      timeoutMs: 1_000,
      maxAttempts: 3,
    });
    const { client, delay } = createClient(request);

    await expect(getJson(client, policy)).rejects.toMatchObject<
      Partial<ExternalHttpError>
    >({
      kind: "network",
      provider: "iNaturalist",
    });
    expect(request).toHaveBeenCalledTimes(3);
    expect(delay).toHaveBeenCalledTimes(2);
  });

  it("uses the timeout supplied by each provider policy for every attempt", async () => {
    const signal = new AbortController().signal;
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(signal);
    const request = vi
      .fn<ExternalHttpFetch>()
      .mockImplementation(async () => Response.json({ results: [] }));
    const { client } = createClient(request);

    await getJson(
      client,
      createExternalHttpPolicy({ timeoutMs: 2_500, maxAttempts: 1 }),
    );
    await client.getJson({
      policy: createExternalHttpPolicy({ timeoutMs: 15_000, maxAttempts: 1 }),
      provider: "GDOŚ",
      url: new URL("https://sdi.gdos.gov.pl/wfs"),
    });

    expect(timeout).toHaveBeenNthCalledWith(1, 2_500);
    expect(timeout).toHaveBeenNthCalledWith(2, 15_000);
  });

  it("keeps the per-attempt timeout active while reading the response body", async () => {
    const response = new Response(null, { status: 200 });
    const request = vi
      .fn<ExternalHttpFetch>()
      .mockImplementation(async (_input, init) => {
        vi.spyOn(response, "json").mockImplementation(
          () =>
            new Promise<never>((_resolve, reject) => {
              const signal = init?.signal;

              if (!(signal instanceof AbortSignal)) {
                reject(new Error("Expected an abort signal"));
                return;
              }

              signal.addEventListener("abort", () => reject(signal.reason), {
                once: true,
              });
            }),
        );

        return response;
      });
    const { client } = createClient(request);

    await expect(
      getJson(
        client,
        createExternalHttpPolicy({ timeoutMs: 1, maxAttempts: 1 }),
      ),
    ).rejects.toMatchObject<Partial<ExternalHttpError>>({
      kind: "timeout",
      provider: "iNaturalist",
      status: 200,
    });
  });

  it("applies exponential backoff with bounded jitter without real waiting", async () => {
    const request = vi
      .fn<ExternalHttpFetch>()
      .mockRejectedValue(new TypeError("fetch failed"));
    const delay = vi.fn<ExternalHttpDelay>().mockResolvedValue(undefined);
    const random = vi
      .fn<ExternalHttpRandom>()
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(1)
      .mockReturnValueOnce(0.5);
    const policy: ExternalHttpPolicy = {
      timeoutMs: 1_000,
      maxAttempts: 4,
      retryableStatusCodes: [503],
      backoff: {
        initialDelayMs: 400,
        maxDelayMs: 500,
        jitterRatio: 0.25,
      },
    };
    const { client } = createClient(request, { delay, random });

    await expect(getJson(client, policy)).rejects.toBeInstanceOf(
      ExternalHttpError,
    );

    expect(delay.mock.calls.map(([delayMs]) => delayMs)).toEqual([
      400, 375, 438,
    ]);
    expect(delay.mock.calls.every(([delayMs]) => delayMs <= 500)).toBe(true);
    expect(calculateExternalHttpOperationBudgetMs(policy)).toBe(5_400);
  });

  it("makes exactly one Nominatim attempt when its policy disables retries", async () => {
    const request = vi
      .fn<ExternalHttpFetch>()
      .mockRejectedValue(new TypeError("fetch failed"));
    const { client, delay } = createClient(request);

    await expect(
      client.getJson({
        policy: createExternalHttpPolicy({
          timeoutMs: 10_000,
          maxAttempts: NOMINATIM_HTTP_MAX_ATTEMPTS,
        }),
        provider: "OpenStreetMap Nominatim",
        url: new URL("https://nominatim.openstreetmap.org/search"),
      }),
    ).rejects.toMatchObject<Partial<ExternalHttpError>>({
      kind: "network",
      provider: "OpenStreetMap Nominatim",
    });
    expect(request).toHaveBeenCalledOnce();
    expect(delay).not.toHaveBeenCalled();
  });

  it.each([0, -1, Number.NaN])(
    "rejects invalid timeout %s before making a request",
    async (timeoutMs) => {
      const request = vi.fn<ExternalHttpFetch>();
      const { client } = createClient(request);

      await expect(
        getJson(client, {
          ...DEFAULT_POLICY,
          timeoutMs,
        }),
      ).rejects.toThrowError(
        new TypeError("External HTTP timeout must be a positive integer"),
      );
      expect(request).not.toHaveBeenCalled();
    },
  );
});
