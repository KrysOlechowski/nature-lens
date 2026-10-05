import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { ProviderError, type ProviderErrorKind } from "./provider.error.js";

interface ProviderErrorResponse {
  code: ProviderErrorCode;
  message: string;
  provider: string;
  statusCode: number;
}

type ProviderErrorCode =
  | "PROVIDER_INVALID_RESPONSE"
  | "PROVIDER_RATE_LIMITED"
  | "PROVIDER_REQUEST_REJECTED"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_UNAVAILABLE";

interface ProviderErrorHttpMapping {
  code: ProviderErrorCode;
  message: string;
  statusCode: number;
}

interface HttpResponse {
  json(body: ProviderErrorResponse): void;
  status(statusCode: number): HttpResponse;
}

const PROVIDER_ERROR_HTTP_MAPPINGS = {
  "invalid-response": {
    code: "PROVIDER_INVALID_RESPONSE",
    message: "The external provider returned an invalid response",
    statusCode: HttpStatus.BAD_GATEWAY,
  },
  "rate-limited": {
    code: "PROVIDER_RATE_LIMITED",
    message: "The external provider is temporarily rate limited",
    statusCode: HttpStatus.SERVICE_UNAVAILABLE,
  },
  "request-rejected": {
    code: "PROVIDER_REQUEST_REJECTED",
    message: "The external provider rejected the request",
    statusCode: HttpStatus.BAD_GATEWAY,
  },
  timeout: {
    code: "PROVIDER_TIMEOUT",
    message: "The external provider timed out",
    statusCode: HttpStatus.GATEWAY_TIMEOUT,
  },
  unavailable: {
    code: "PROVIDER_UNAVAILABLE",
    message: "The external provider is currently unavailable",
    statusCode: HttpStatus.SERVICE_UNAVAILABLE,
  },
} satisfies Record<ProviderErrorKind, ProviderErrorHttpMapping>;

@Catch(ProviderError)
export class ProviderExceptionFilter implements ExceptionFilter<ProviderError> {
  private readonly logger = new Logger(ProviderExceptionFilter.name);

  catch(exception: ProviderError, host: ArgumentsHost): void {
    const mapping = PROVIDER_ERROR_HTTP_MAPPINGS[exception.kind];
    const response = host.switchToHttp().getResponse<HttpResponse>();
    const upstreamStatus = exception.upstreamStatus
      ? ` upstreamStatus=${exception.upstreamStatus}`
      : "";

    this.logger.warn(
      `Provider request failed provider=${exception.provider} kind=${exception.kind}${upstreamStatus} responseStatus=${mapping.statusCode} code=${mapping.code}`,
    );

    response.status(mapping.statusCode).json({
      statusCode: mapping.statusCode,
      code: mapping.code,
      message: mapping.message,
      provider: exception.provider,
    });
  }
}
