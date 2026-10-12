import { Module } from "@nestjs/common";
import { environment } from "../config/environment.js";
import { ExternalHttpModule } from "../external-http/external-http.module.js";
import { PROTECTED_AREAS_PROVIDER } from "../protected-areas/protected-areas.tokens.js";
import { GdosAdapter } from "./gdos.adapter.js";
import { GDOS_WFS_URL } from "./gdos.tokens.js";

@Module({
  imports: [ExternalHttpModule],
  providers: [
    GdosAdapter,
    {
      provide: PROTECTED_AREAS_PROVIDER,
      useExisting: GdosAdapter,
    },
    {
      provide: GDOS_WFS_URL,
      useValue: environment.GDOS_WFS_URL,
    },
  ],
  exports: [PROTECTED_AREAS_PROVIDER],
})
export class GdosModule {}
