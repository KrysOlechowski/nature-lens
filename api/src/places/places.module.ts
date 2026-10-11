import { Module } from "@nestjs/common";
import { NominatimModule } from "../nominatim/nominatim.module.js";
import { PlacesController } from "./places.controller.js";
import { PlacesService } from "./places.service.js";

@Module({
  imports: [NominatimModule],
  controllers: [PlacesController],
  providers: [PlacesService],
})
export class PlacesModule {}
