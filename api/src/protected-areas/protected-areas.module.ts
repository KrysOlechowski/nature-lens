import { Module } from "@nestjs/common";
import { GdosModule } from "../gdos/gdos.module.js";
import { ProtectedAreasController } from "./protected-areas.controller.js";
import { ProtectedAreasService } from "./protected-areas.service.js";

@Module({
  imports: [GdosModule],
  controllers: [ProtectedAreasController],
  providers: [ProtectedAreasService],
})
export class ProtectedAreasModule {}
