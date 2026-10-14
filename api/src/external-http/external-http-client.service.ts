import { Inject, Injectable, Logger } from "@nestjs/common";
import { ExternalHttpError } from "./external-http.error.js";
import type { ExternalHttpPolicy } from "./external-http-policy.js";
import {
  EXTERNAL_HTTP_DELAY,
  EXTERNAL_HTTP_FETCH,
  EXTERNAL_HTTP_RANDOM,
  type ExternalHttpDelay,
  type ExternalHttpFetch,
  type ExternalHttpRandom,
} from "./external-http.tokens.js";

export interface ExternalHttpRequest {
  policy: ExternalHttpPolicy;
  provider: string;
  url: URL;
  userAgent?: string;
}

@Injectable()
export class ExternalHttpClient {
  private readonly logger = new Logger(ExternalHttpClient.name);

  constructor(
    @Inject(EXTERNAL_HTTP_FETCH)
    private readonly request: ExternalHttpFetch,
    @Inject(EXTERNAL_HTTP_DELAY)
    private readonly delay: ExternalHttpDelay,
    @Inject(EXTERNAL_HTTP_RANDOM)
    private readonly random: ExternalHttpRandom,
  ) {}

  async getJson({
    policy,
    provider,
    url,
    userAgent,
  }: ExternalHttpRequest): Promise<unknown> {
    const normalizedProvider = provider.trim();

    if (!normalizedProvider) {
      throw new TypeError("External HTTP requests require a provider name");
    }

    const normalizedUserAgent = userAgent?.trim();

    if (userAgent !== undefined && !normalizedUserAgent) {
      throw new TypeError("External HTTP user agent cannot be blank");
    }

    assertExternalHttpPolicy(policy);

    const endpoint = url.pathname;
    for (let attempt = 1; attempt <= policy.maxAttempts; attempt += 1) {
      try {
        return await this.performAttempt({
          endpoint,
          normalizedProvider,
          normalizedUserAgent,
          policy,
          url,
          attempt,
        });
      } catch (error) {
        if (
          !(error instanceof ExternalHttpError) ||
          attempt >= policy.maxAttempts ||
          !isRetryable(error, policy)
        ) {
          throw error;
        }

        const delayMs = calculateBackoffDelay(policy, attempt, this.random());

        this.logger.warn("External HTTP GET retry scheduled", {
          event: "provider.http.retry-scheduled",
          provider: normalizedProvider,
          endpoint,
          attempt,
          nextAttempt: attempt + 1,
          maxAttempts: policy.maxAttempts,
          delayMs,
          errorKind: error.kind,
          ...(error.status === undefined ? {} : { status: error.status }),
        });

        await this.delay(delayMs);
      }
    }

    throw new Error("External HTTP attempts exhausted unexpectedly");
  }

  private async performAttempt({
    endpoint,
    normalizedProvider,
    normalizedUserAgent,
    policy,
    url,
    attempt,
  }: {
    endpoint: string;
    normalizedProvider: string;
    normalizedUserAgent?: string;
    policy: ExternalHttpPolicy;
    url: URL;
    attempt: number;
  }): Promise<unknown> {
    const startedAt = performance.now();
    const signal = AbortSignal.timeout(policy.timeoutMs);
    let response: Response;

    this.logger.debug("External HTTP GET started", {
      event: "provider.http.started",
      provider: normalizedProvider,
      endpoint,
      attempt,
      maxAttempts: policy.maxAttempts,
      timeoutMs: policy.timeoutMs,
    });

    try {
      response = await this.request(url, {
        headers: {
          accept: "application/json",
          ...(normalizedUserAgent ? { "user-agent": normalizedUserAgent } : {}),
        },
        signal,
      });
    } catch (cause) {
      const kind =
        signal.aborted || isTimeoutError(cause) ? "timeout" : "network";
      const durationMs = elapsedMilliseconds(startedAt);

      this.logger.warn("External HTTP GET failed", {
        event: "provider.http.failed",
        provider: normalizedProvider,
        endpoint,
        attempt,
        maxAttempts: policy.maxAttempts,
        latencyMs: durationMs,
        errorKind: kind,
      });

      throw new ExternalHttpError(
        kind === "timeout"
          ? `External request to ${normalizedProvider} timed out`
          : `External request to ${normalizedProvider} failed`,
        { cause, kind, provider: normalizedProvider },
      );
    }

    if (!response.ok) {
      const durationMs = elapsedMilliseconds(startedAt);

      this.logger.warn("External HTTP GET failed", {
        event: "provider.http.failed",
        provider: normalizedProvider,
        endpoint,
        attempt,
        maxAttempts: policy.maxAttempts,
        status: response.status,
        latencyMs: durationMs,
        errorKind: "http",
      });

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

      this.logger.log("External HTTP GET completed", {
        event: "provider.http.completed",
        provider: normalizedProvider,
        endpoint,
        attempt,
        maxAttempts: policy.maxAttempts,
        status: response.status,
        latencyMs: durationMs,
      });

      return body;
    } catch (cause) {
      const kind =
        signal.aborted || isTimeoutError(cause)
          ? "timeout"
          : "invalid-response";
      const durationMs = elapsedMilliseconds(startedAt);

      this.logger.warn("External HTTP GET failed", {
        event: "provider.http.failed",
        provider: normalizedProvider,
        endpoint,
        attempt,
        maxAttempts: policy.maxAttempts,
        status: response.status,
        latencyMs: durationMs,
        errorKind: kind === "invalid-response" ? "invalid-json" : kind,
      });

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

function assertExternalHttpPolicy(
  policy: ExternalHttpPolicy,
): asserts policy is ExternalHttpPolicy {
  if (!Number.isInteger(policy.timeoutMs) || policy.timeoutMs <= 0) {
    throw new TypeError("External HTTP timeout must be a positive integer");
  }

  if (!Number.isInteger(policy.maxAttempts) || policy.maxAttempts <= 0) {
    throw new TypeError("External HTTP maxAttempts must be a positive integer");
  }

  if (
    !Number.isInteger(policy.backoff.initialDelayMs) ||
    policy.backoff.initialDelayMs < 0 ||
    !Number.isInteger(policy.backoff.maxDelayMs) ||
    policy.backoff.maxDelayMs < policy.backoff.initialDelayMs
  ) {
    throw new TypeError("External HTTP backoff bounds are invalid");
  }

  if (
    !Number.isFinite(policy.backoff.jitterRatio) ||
    policy.backoff.jitterRatio < 0 ||
    policy.backoff.jitterRatio > 1
  ) {
    throw new TypeError("External HTTP jitter ratio must be between 0 and 1");
  }
}

function isRetryable(
  error: ExternalHttpError,
  policy: ExternalHttpPolicy,
): boolean {
  if (error.kind === "network" || error.kind === "timeout") {
    return true;
  }

  return (
    error.kind === "http" &&
    error.status !== undefined &&
    policy.retryableStatusCodes.includes(error.status)
  );
}

function calculateBackoffDelay(
  policy: ExternalHttpPolicy,
  failedAttempt: number,
  random: number,
): number {
  const exponentialDelay = Math.min(
    policy.backoff.maxDelayMs,
    policy.backoff.initialDelayMs * 2 ** (failedAttempt - 1),
  );
  const boundedRandom = Math.min(1, Math.max(0, random));
  const jitterMultiplier = 1 - policy.backoff.jitterRatio * boundedRandom;

  return Math.round(exponentialDelay * jitterMultiplier);
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.name === "TimeoutError";
}

function elapsedMilliseconds(startedAt: number): number {
  return Math.round(performance.now() - startedAt);
}
