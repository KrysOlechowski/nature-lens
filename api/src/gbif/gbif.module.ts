import { Module } from "@nestjs/common";
import { ExternalHttpModule } from "../external-http/external-http.module.js";
import { GBIFAdapter } from "./gbif.adapter.js";

@Module({
  imports: [ExternalHttpModule],
  providers: [GBIFAdapter],
  exports: [GBIFAdapter],
})
export class GBIFModule {}
