import { EventEmitter } from "node:events";
import {
  ConsoleLogger,
  Logger,
  type LogLevel,
  type MiddlewareConsumer,
  RequestMethod,
} from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module.js";
import { LoggingModule } from "../src/logging/logging.module.js";
import { getRequestContext } from "../src/logging/request-context.js";
import { RequestContextMiddleware } from "../src/logging/request-context.middleware.js";
import { StructuredLogger } from "../src/logging/structured-logger.js";

interface JsonLogOptions {
  context: string;
  logLevel: LogLevel;
  writeStreamType?: "stdout" | "stderr";
  errorStack?: unknown;
  params?: Record<string, unknown>;
}

class CapturingStructuredLogger extends StructuredLogger {
  readonly entries: Array<Record<string, unknown>> = [];

  protected override printAsJson(
    message: unknown,
    options: JsonLogOptions,
  ): void {
    this.entries.push(this.getJsonLogObject(message, options));
  }
}

class TestResponse extends EventEmitter {
  readonly headers = new Map<string, string>();
  statusCode = 200;

  setHeader(name: string, value: string): void {
    this.headers.set(name, value);
  }
}

describe("RequestContextMiddleware", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
  });

  it("is registered for every API route", () => {
    const imports = Reflect.getMetadata("imports", AppModule) as unknown[];
    const forRoutes = vi.fn();
    const apply = vi.fn().mockReturnValue({ forRoutes });

    new LoggingModule().configure({ apply } as unknown as MiddlewareConsumer);

    expect(imports).toContain(LoggingModule);
    expect(apply).toHaveBeenCalledWith(RequestContextMiddleware);
    expect(forRoutes).toHaveBeenCalledWith({
      path: "{*path}",
      method: RequestMethod.ALL,
    });
  });

  it("keeps one request ID through an async controller-service-provider chain", async () => {
    const middleware = new RequestContextMiddleware();
    const response = new TestResponse();
    let providerRequestId: string | undefined;
    let asyncChain: Promise<void> | undefined;

    const provider = async () => {
      await Promise.resolve();
      providerRequestId = getRequestContext()?.requestId;
    };
    const service = async () => provider();
    const controller = async () => service();

    middleware.use(
      { method: "GET", url: "/api/species/search?q=secret" },
      response,
      () => {
        asyncChain = controller();
      },
    );

    await asyncChain;
    const responseRequestId = response.headers.get("X-Request-ID");

    expect(responseRequestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(providerRequestId).toBe(responseRequestId);
  });

  it("isolates concurrent request contexts", async () => {
    const middleware = new RequestContextMiddleware();
    const firstResponse = new TestResponse();
    const secondResponse = new TestResponse();
    const observedRequestIds: string[] = [];
    let releaseRequests: (() => void) | undefined;
    const requestsMayFinish = new Promise<void>((resolve) => {
      releaseRequests = resolve;
    });

    const runRequest = (response: TestResponse) =>
      new Promise<void>((resolve) => {
        middleware.use({ method: "GET", url: "/api/health" }, response, () => {
          void (async () => {
            await requestsMayFinish;
            observedRequestIds.push(
              getRequestContext()?.requestId ?? "missing",
            );
            resolve();
          })();
        });
      });

    const requests = [runRequest(firstResponse), runRequest(secondResponse)];
    releaseRequests?.();
    await Promise.all(requests);

    const firstRequestId = firstResponse.headers.get("X-Request-ID");
    const secondRequestId = secondResponse.headers.get("X-Request-ID");

    expect(firstRequestId).toBeDefined();
    expect(secondRequestId).toBeDefined();
    expect(firstRequestId).not.toBe(secondRequestId);
    expect(observedRequestIds).toHaveLength(2);
    expect(new Set(observedRequestIds)).toEqual(
      new Set([firstRequestId, secondRequestId]),
    );
  });

  it("logs completion exactly once with the final error status and no query", () => {
    vi.restoreAllMocks();
    const logger = new CapturingStructuredLogger();
    Logger.overrideLogger(logger);
    const middleware = new RequestContextMiddleware();
    const response = new TestResponse();
    let requestIdDuringRequest: string | undefined;

    try {
      middleware.use(
        {
          method: "GET",
          originalUrl: "/api/places/search?q=private-value",
          url: "/places/search?q=private-value",
        },
        response,
        () => {
          requestIdDuringRequest = getRequestContext()?.requestId;
          response.statusCode = 502;
          response.emit("finish");
          response.emit("finish");
        },
      );
    } finally {
      Logger.overrideLogger(new ConsoleLogger());
    }

    expect(response.headers.get("X-Request-ID")).toBe(requestIdDuringRequest);
    expect(logger.entries).toHaveLength(1);
    expect(logger.entries[0]).toMatchObject({
      message: "HTTP request completed",
      event: "http.request.completed",
      requestId: requestIdDuringRequest,
      method: "GET",
      path: "/api/places/search",
      status: 502,
      latencyMs: expect.any(Number),
    });
    expect(JSON.stringify(logger.entries)).not.toContain("private-value");
  });
});
