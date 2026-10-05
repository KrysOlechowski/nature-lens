export type ProviderErrorKind =
  | "invalid-response"
  | "rate-limited"
  | "request-rejected"
  | "timeout"
  | "unavailable";

interface ProviderErrorOptions {
  cause?: unknown;
  kind: ProviderErrorKind;
  provider: string;
  upstreamStatus?: number;
}

export class ProviderError extends Error {
  readonly kind: ProviderErrorKind;
  readonly provider: string;
  readonly upstreamStatus?: number;

  constructor(message: string, options: ProviderErrorOptions) {
    super(message, { cause: options.cause });
    this.name = ProviderError.name;
    this.kind = options.kind;
    this.provider = options.provider;
    this.upstreamStatus = options.upstreamStatus;
  }
}
