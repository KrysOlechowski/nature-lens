import { Logger } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExternalHttpClient } from "../src/external-http/external-http-client.service.js";
import { ExternalHttpError } from "../src/external-http/external-http.error.js";
import type { ExternalHttpFetch } from "../src/external-http/external-http.tokens.js";

describe("ExternalHttpClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(Logger.prototype, "debug").mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
  });

  it("fetches JSON with the controlled request settings", async () => {
    const request = vi.fn<ExternalHttpFetch>().mockResolvedValue(
      new Response(JSON.stringify({ results: [] }), {
        headers: { "content-type": "application/json" },
        status: 200,
      }),
    );
    const client = new ExternalHttpClient(request, 5_000);
    const url = new URL(
      "https://api.inaturalist.org/v1/taxa?q=secret-search-term",
    );

    await expect(
      client.getJson({ provider: "iNaturalist", url }),
    ).resolves.toEqual({ results: [] });
    expect(request).toHaveBeenCalledWith(url, {
      headers: { accept: "application/json" },
      signal: expect.any(AbortSignal),
    });
    expect(Logger.prototype.log).toHaveBeenCalledWith(
      expect.stringContaining(
        "provider=iNaturalist endpoint=https://api.inaturalist.org/v1/taxa status=200",
      ),
    );
    expect(Logger.prototype.log).not.toHaveBeenCalledWith(
      expect.stringContaining("secret-search-term"),
    );
  });

  it("reports non-successful HTTP responses", async () => {
    const request = vi
      .fn<ExternalHttpFetch>()
      .mockResolvedValue(new Response(null, { status: 503 }));
    const client = new ExternalHttpClient(request, 5_000);

    await expect(
      client.getJson({
        provider: "iNaturalist",
        url: new URL("https://api.inaturalist.org/v1/taxa"),
      }),
    ).rejects.toMatchObject<Partial<ExternalHttpError>>({
      kind: "http",
      provider: "iNaturalist",
      status: 503,
    });
  });

  it("distinguishes timeouts from other transport failures", async () => {
    const request = vi
      .fn<ExternalHttpFetch>()
      .mockRejectedValue(new DOMException("Timed out", "TimeoutError"));
    const client = new ExternalHttpClient(request, 5_000);

    await expect(
      client.getJson({
        provider: "iNaturalist",
        url: new URL("https://api.inaturalist.org/v1/taxa"),
      }),
    ).rejects.toMatchObject<Partial<ExternalHttpError>>({
      kind: "timeout",
      provider: "iNaturalist",
    });
  });

  it("keeps the timeout active while reading the response body", async () => {
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
    const client = new ExternalHttpClient(request, 1);

    await expect(
      client.getJson({
        provider: "iNaturalist",
        url: new URL("https://api.inaturalist.org/v1/taxa"),
      }),
    ).rejects.toMatchObject<Partial<ExternalHttpError>>({
      kind: "timeout",
      provider: "iNaturalist",
      status: 200,
    });
  });

  it("reports transport failures without exposing their implementation", async () => {
    const request = vi
      .fn<ExternalHttpFetch>()
      .mockRejectedValue(new TypeError("fetch failed"));
    const client = new ExternalHttpClient(request, 5_000);

    await expect(
      client.getJson({
        provider: "iNaturalist",
        url: new URL("https://api.inaturalist.org/v1/taxa"),
      }),
    ).rejects.toMatchObject<Partial<ExternalHttpError>>({
      kind: "network",
      provider: "iNaturalist",
    });
  });

  it("keeps invalid JSON separate from provider contract validation", async () => {
    const request = vi
      .fn<ExternalHttpFetch>()
      .mockResolvedValue(new Response("not-json", { status: 200 }));
    const client = new ExternalHttpClient(request, 5_000);

    await expect(
      client.getJson({
        provider: "iNaturalist",
        url: new URL("https://api.inaturalist.org/v1/taxa"),
      }),
    ).rejects.toMatchObject<Partial<ExternalHttpError>>({
      kind: "invalid-response",
      provider: "iNaturalist",
      status: 200,
    });
  });
});
