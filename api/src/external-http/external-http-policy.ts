export interface ExternalHttpPolicy {
  timeoutMs: number;
  maxAttempts: number;
  retryableStatusCodes: readonly number[];
  backoff: {
    initialDelayMs: number;
    maxDelayMs: number;
    jitterRatio: number;
  };
}

export const TRANSIENT_GET_RETRY_STATUS_CODES = [502, 503, 504] as const;

export function createExternalHttpPolicy({
  timeoutMs,
  maxAttempts,
}: Pick<ExternalHttpPolicy, "timeoutMs" | "maxAttempts">): ExternalHttpPolicy {
  return {
    timeoutMs,
    maxAttempts,
    retryableStatusCodes: TRANSIENT_GET_RETRY_STATUS_CODES,
    backoff: {
      initialDelayMs: 250,
      maxDelayMs: 1_000,
      jitterRatio: 0.2,
    },
  };
}

export function calculateExternalHttpOperationBudgetMs(
  policy: ExternalHttpPolicy,
): number {
  let maximumBackoffMs = 0;

  for (
    let failedAttempt = 1;
    failedAttempt < policy.maxAttempts;
    failedAttempt += 1
  ) {
    maximumBackoffMs += Math.min(
      policy.backoff.maxDelayMs,
      policy.backoff.initialDelayMs * 2 ** (failedAttempt - 1),
    );
  }

  return policy.timeoutMs * policy.maxAttempts + maximumBackoffMs;
}
