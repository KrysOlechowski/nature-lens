export type ExternalHttpErrorKind =
  "http" | "invalid-response" | "network" | "timeout";

interface ExternalHttpErrorOptions {
  cause?: unknown;
  kind: ExternalHttpErrorKind;
  provider: string;
  status?: number;
}

export class ExternalHttpError extends Error {
  readonly kind: ExternalHttpErrorKind;
  readonly provider: string;
  readonly status?: number;

  constructor(message: string, options: ExternalHttpErrorOptions) {
    super(message, { cause: options.cause });
    this.name = ExternalHttpError.name;
    this.kind = options.kind;
    this.provider = options.provider;
    this.status = options.status;
  }
}
