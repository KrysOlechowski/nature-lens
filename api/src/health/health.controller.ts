import { Controller, Get } from "@nestjs/common";
import { HealthResponseDto } from "./health-response.dto.js";

@Controller("health")
export class HealthController {
  @Get()
  getHealth(): HealthResponseDto {
    return new HealthResponseDto();
  }
}
