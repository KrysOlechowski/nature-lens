import { Module } from "@nestjs/common";
import { environment } from "../config/environment.js";
import { ExternalHttpModule } from "../external-http/external-http.module.js";
import { createExternalHttpPolicy } from "../external-http/external-http-policy.js";
import { NominatimAdapter } from "./nominatim.adapter.js";
import { NOMINATIM_HTTP_MAX_ATTEMPTS } from "./nominatim.constants.js";
import {
  NOMINATIM_LOOKUP_URL,
  NOMINATIM_HTTP_POLICY,
  NOMINATIM_PLACE_LOOKUP_PROVIDER,
  NOMINATIM_PLACE_SEARCH_PROVIDER,
  NOMINATIM_SEARCH_URL,
  NOMINATIM_USER_AGENT,
} from "./nominatim.tokens.js";

@Module({
  imports: [ExternalHttpModule],
  providers: [
    NominatimAdapter,
    {
      provide: NOMINATIM_HTTP_POLICY,
      useValue: createExternalHttpPolicy({
        timeoutMs: environment.NOMINATIM_HTTP_TIMEOUT_MS,
        maxAttempts: NOMINATIM_HTTP_MAX_ATTEMPTS,
      }),
    },
    {
      provide: NOMINATIM_PLACE_SEARCH_PROVIDER,
      useExisting: NominatimAdapter,
    },
    {
      provide: NOMINATIM_PLACE_LOOKUP_PROVIDER,
      useExisting: NominatimAdapter,
    },
    {
      provide: NOMINATIM_LOOKUP_URL,
      useValue: environment.NOMINATIM_LOOKUP_URL,
    },
    {
      provide: NOMINATIM_SEARCH_URL,
      useValue: environment.NOMINATIM_SEARCH_URL,
    },
    {
      provide: NOMINATIM_USER_AGENT,
      useValue: environment.NOMINATIM_USER_AGENT,
    },
  ],
  exports: [NOMINATIM_PLACE_LOOKUP_PROVIDER, NOMINATIM_PLACE_SEARCH_PROVIDER],
})
export class NominatimModule {}
