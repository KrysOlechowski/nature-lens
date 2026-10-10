import { Module } from "@nestjs/common";
import { ExternalHttpModule } from "../external-http/external-http.module.js";
import { INaturalistAdapter } from "./inaturalist.adapter.js";
import {
  INATURALIST_OBSERVATION_PROVIDER,
  INATURALIST_SPECIES_SEARCH_PROVIDER,
} from "./inaturalist.tokens.js";

@Module({
  imports: [ExternalHttpModule],
  providers: [
    INaturalistAdapter,
    {
      provide: INATURALIST_SPECIES_SEARCH_PROVIDER,
      useExisting: INaturalistAdapter,
    },
    {
      provide: INATURALIST_OBSERVATION_PROVIDER,
      useExisting: INaturalistAdapter,
    },
  ],
  exports: [
    INATURALIST_SPECIES_SEARCH_PROVIDER,
    INATURALIST_OBSERVATION_PROVIDER,
  ],
})
export class INaturalistModule {}
