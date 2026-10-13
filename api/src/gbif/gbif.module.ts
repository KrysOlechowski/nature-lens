import { Module } from "@nestjs/common";
import { environment } from "../config/environment.js";
import { ExternalHttpModule } from "../external-http/external-http.module.js";
import { createExternalHttpPolicy } from "../external-http/external-http-policy.js";
import { GBIFAdapter } from "./gbif.adapter.js";
import {
  GBIF_HTTP_POLICY,
  GBIF_OBSERVATION_PROVIDER,
  GBIF_TAXON_MATCH_PROVIDER,
} from "./gbif.tokens.js";

@Module({
  imports: [ExternalHttpModule],
  providers: [
    GBIFAdapter,
    {
      provide: GBIF_HTTP_POLICY,
      useValue: createExternalHttpPolicy({
        timeoutMs: environment.GBIF_HTTP_TIMEOUT_MS,
        maxAttempts: 2,
      }),
    },
    {
      provide: GBIF_OBSERVATION_PROVIDER,
      useExisting: GBIFAdapter,
    },
    {
      provide: GBIF_TAXON_MATCH_PROVIDER,
      useExisting: GBIFAdapter,
    },
  ],
  exports: [GBIF_OBSERVATION_PROVIDER, GBIF_TAXON_MATCH_PROVIDER],
})
export class GBIFModule {}
