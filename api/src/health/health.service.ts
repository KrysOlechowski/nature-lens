import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { DatabaseService } from "../database/database.service.js";

@Injectable()
export class HealthService {
  constructor(private readonly database: DatabaseService) {}

  async checkReadiness(): Promise<void> {
    try {
      await this.database.query("SELECT 1");
    } catch (error) {
      throw new ServiceUnavailableException("Database is unavailable", {
        cause: error,
      });
    }
  }
}
