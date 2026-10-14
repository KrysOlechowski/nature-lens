import { type LogLevel } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { requestContextStorage } from "../src/logging/request-context.js";
import { StructuredLogger } from "../src/logging/structured-logger.js";

class InspectableStructuredLogger extends StructuredLogger {
  createLogEntry(
    message: string,
    params?: Record<string, unknown>,
  ): Record<string, unknown> {
    return this.getJsonLogObject(message, {
      context: "TestContext",
      logLevel: "log" satisfies LogLevel,
      params,
    });
  }
}

describe("StructuredLogger", () => {
  it("adds the active request ID and flattens structured metadata", () => {
    const logger = new InspectableStructuredLogger();

    const entry = requestContextStorage.run(
      { requestId: "4cf4d4cb-a895-47f9-8452-1fa6613372f9" },
      () =>
        logger.createLogEntry("Provider request completed", {
          provider: "iNaturalist",
          latencyMs: 42,
        }),
    );

    expect(entry).toMatchObject({
      message: "Provider request completed",
      context: "TestContext",
      requestId: "4cf4d4cb-a895-47f9-8452-1fa6613372f9",
      provider: "iNaturalist",
      latencyMs: 42,
    });
    expect(entry).not.toHaveProperty("params");
  });

  it("logs outside an HTTP request without a request ID", () => {
    const logger = new InspectableStructuredLogger();

    const entry = logger.createLogEntry("Application started");

    expect(entry).toMatchObject({
      message: "Application started",
      context: "TestContext",
    });
    expect(entry).not.toHaveProperty("requestId");
  });
});
