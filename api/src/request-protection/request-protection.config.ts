import type { ThrottlerModuleOptions } from "@nestjs/throttler";
import { environment } from "../config/environment.js";

const rateLimitTtlMilliseconds =
  environment.API_RATE_LIMIT_WINDOW_SECONDS * 1_000;

export const API_RATE_LIMIT_OPTIONS = [
  {
    ttl: rateLimitTtlMilliseconds,
    limit: environment.API_RATE_LIMIT_REQUESTS,
  },
] satisfies ThrottlerModuleOptions;

export const EXPENSIVE_REQUEST_THROTTLE = {
  default: {
    ttl: rateLimitTtlMilliseconds,
    limit: environment.API_EXPENSIVE_RATE_LIMIT_REQUESTS,
  },
};
