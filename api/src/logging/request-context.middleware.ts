import { randomUUID } from "node:crypto";
import { Injectable, Logger, type NestMiddleware } from "@nestjs/common";
import { requestContextStorage } from "./request-context.js";

interface HttpRequest {
  method: string;
  originalUrl?: string;
  url: string;
}

interface HttpResponse {
  once(event: "finish", listener: () => void): this;
  setHeader(name: string, value: string): void;
  statusCode: number;
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware<
  HttpRequest,
  HttpResponse
> {
  private readonly logger = new Logger(RequestContextMiddleware.name);

  use(
    request: HttpRequest,
    response: HttpResponse,
    next: (error?: unknown) => void,
  ): void {
    const requestId = randomUUID();
    const requestContext = { requestId };
    const startedAt = performance.now();
    const path = getPathWithoutQuery(request.originalUrl ?? request.url);

    requestContextStorage.run(requestContext, () => {
      response.setHeader("X-Request-ID", requestId);
      response.once("finish", () => {
        requestContextStorage.run(requestContext, () => {
          this.logger.log("HTTP request completed", {
            event: "http.request.completed",
            method: request.method,
            path,
            status: response.statusCode,
            latencyMs: elapsedMilliseconds(startedAt),
          });
        });
      });

      next();
    });
  }
}

function getPathWithoutQuery(url: string): string {
  return url.split("?", 1)[0] || "/";
}

function elapsedMilliseconds(startedAt: number): number {
  return Math.max(0, Math.round(performance.now() - startedAt));
}
