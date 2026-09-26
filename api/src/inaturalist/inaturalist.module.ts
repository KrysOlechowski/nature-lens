import { Module } from "@nestjs/common";
import { ExternalHttpModule } from "../external-http/external-http.module.js";
import { INaturalistAdapter } from "./inaturalist.adapter.js";

@Module({
  imports: [ExternalHttpModule],
  providers: [INaturalistAdapter],
  exports: [INaturalistAdapter],
})
export class INaturalistModule {}
