import { Inject, Injectable, Logger } from "@nestjs/common";
import { ExternalHttpError } from "./external-http.error.js";
import {
  EXTERNAL_HTTP_FETCH,
  EXTERNAL_HTTP_TIMEOUT_MS,
  type ExternalHttpFetch,
} from "./external-http.tokens.js";

export interface ExternalHttpRequest {
  provider: string;
  url: URL;
}

@Injectable()
export class ExternalHttpClient {
  private readonly logger = new Logger(ExternalHttpClient.name);

  constructor(
    @Inject(EXTERNAL_HTTP_FETCH)
    private readonly request: ExternalHttpFetch,
    @Inject(EXTERNAL_HTTP_TIMEOUT_MS)
    private readonly timeoutMs: number,
  ) {}

  async getJson({ provider, url }: ExternalHttpRequest): Promise<unknown> {
    const normalizedProvider = provider.trim();

    if (!normalizedProvider) {
      throw new TypeError("External HTTP requests require a provider name");
    }

    const endpoint = `${url.origin}${url.pathname}`;
    const startedAt = performance.now();
    const signal = AbortSignal.timeout(this.timeoutMs);
    let response: Response;

    this.logger.debug(
      `External HTTP GET started provider=${normalizedProvider} endpoint=${endpoint}`,
    );

    try {
      response = await this.request(url, {
        headers: { accept: "application/json" },
        signal,
      });
    } catch (cause) {
      const kind =
        signal.aborted || isTimeoutError(cause) ? "timeout" : "network";
      const durationMs = elapsedMilliseconds(startedAt);

      this.logger.warn(
        `External HTTP GET failed provider=${normalizedProvider} endpoint=${endpoint} kind=${kind} durationMs=${durationMs}`,
      );

      throw new ExternalHttpError(
        kind === "timeout"
          ? `External request to ${normalizedProvider} timed out`
          : `External request to ${normalizedProvider} failed`,
        { cause, kind, provider: normalizedProvider },
      );
    }

    if (!response.ok) {
      const durationMs = elapsedMilliseconds(startedAt);

      this.logger.warn(
        `External HTTP GET failed provider=${normalizedProvider} endpoint=${endpoint} kind=http status=${response.status} durationMs=${durationMs}`,
      );

      throw new ExternalHttpError(
        `External request to ${normalizedProvider} returned HTTP ${response.status}`,
        {
          kind: "http",
          provider: normalizedProvider,
          status: response.status,
        },
      );
    }

    try {
      const body: unknown = await response.json();
      const durationMs = elapsedMilliseconds(startedAt);

      this.logger.log(
        `External HTTP GET completed provider=${normalizedProvider} endpoint=${endpoint} status=${response.status} durationMs=${durationMs}`,
      );

      return body;
    } catch (cause) {
      const kind =
        signal.aborted || isTimeoutError(cause)
          ? "timeout"
          : "invalid-response";
      const durationMs = elapsedMilliseconds(startedAt);

      this.logger.warn(
        `External HTTP GET failed provider=${normalizedProvider} endpoint=${endpoint} kind=${kind} status=${response.status} durationMs=${durationMs}`,
      );

      throw new ExternalHttpError(
        kind === "timeout"
          ? `External request to ${normalizedProvider} timed out`
          : `External response from ${normalizedProvider} was not valid JSON`,
        {
          cause,
          kind,
          provider: normalizedProvider,
          status: response.status,
        },
      );
    }
  }
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.name === "TimeoutError";
}

function elapsedMilliseconds(startedAt: number): number {
  return Math.round(performance.now() - startedAt);
}
