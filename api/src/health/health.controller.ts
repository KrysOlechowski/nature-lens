import { Controller, Get } from "@nestjs/common";
import { HealthResponseDto } from "./health-response.dto.js";
import { HealthService } from "./health.service.js";
import { ReadinessResponseDto } from "./readiness-response.dto.js";

@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getHealth(): HealthResponseDto {
    return new HealthResponseDto();
  }

  @Get("ready")
  async getReadiness(): Promise<ReadinessResponseDto> {
    await this.healthService.checkReadiness();

    return new ReadinessResponseDto();
  }
}
