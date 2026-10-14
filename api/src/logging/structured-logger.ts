import { ConsoleLogger, type LogLevel } from "@nestjs/common";
import { getRequestContext } from "./request-context.js";

interface JsonLogOptions {
  context: string;
  logLevel: LogLevel;
  writeStreamType?: "stdout" | "stderr";
  errorStack?: unknown;
  params?: Record<string, unknown>;
}

export class StructuredLogger extends ConsoleLogger {
  constructor() {
    super({
      colors: false,
      compact: true,
      flattenParams: true,
      json: true,
      structuredParams: true,
    });
  }

  protected override getJsonLogObject(
    message: unknown,
    options: JsonLogOptions,
  ) {
    const logEntry = super.getJsonLogObject(message, options);
    const requestContext = getRequestContext();

    if (!requestContext) {
      return logEntry;
    }

    return {
      ...logEntry,
      requestId: requestContext.requestId,
    };
  }
}
