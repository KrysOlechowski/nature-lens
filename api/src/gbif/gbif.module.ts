import { Module } from "@nestjs/common";
import { ExternalHttpModule } from "../external-http/external-http.module.js";
import { GBIFAdapter } from "./gbif.adapter.js";
import { GBIF_OBSERVATION_PROVIDER } from "./gbif.tokens.js";

@Module({
  imports: [ExternalHttpModule],
  providers: [
    GBIFAdapter,
    {
      provide: GBIF_OBSERVATION_PROVIDER,
      useExisting: GBIFAdapter,
    },
  ],
  exports: [GBIF_OBSERVATION_PROVIDER],
})
export class GBIFModule {}
