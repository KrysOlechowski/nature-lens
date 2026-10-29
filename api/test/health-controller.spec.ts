import "reflect-metadata";
import { Module, type INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { DatabaseService } from "../src/database/database.service.js";
import { HealthController } from "../src/health/health.controller.js";
import { HealthService } from "../src/health/health.service.js";

const query = vi.fn();

class HealthTestModule {}

Module({
  controllers: [HealthController],
  providers: [
    HealthService,
    {
      provide: DatabaseService,
      useValue: { query },
    },
  ],
})(HealthTestModule);

describe("health endpoints", () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    app = await NestFactory.create(HealthTestModule, { logger: false });
    app.setGlobalPrefix("api");
    await app.listen(0, "127.0.0.1");
    baseUrl = await app.getUrl();
  });

  beforeEach(() => {
    query.mockReset();
  });

  afterAll(async () => {
    await app?.close();
  });

  it("keeps liveness independent from the database", async () => {
    const response = await fetch(`${baseUrl}/api/health`);

    await expect(response.json()).resolves.toEqual({
      status: "ok",
      version: "1",
    });
    expect(response.status).toBe(200);
    expect(query).not.toHaveBeenCalled();
  });

  it("returns 200 when the database readiness query succeeds", async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const response = await fetch(`${baseUrl}/api/health/ready`);

    await expect(response.json()).resolves.toEqual({ status: "ok" });
    expect(response.status).toBe(200);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith("SELECT 1");
  });

  it("returns 503 when the database readiness query fails", async () => {
    query.mockRejectedValueOnce(new Error("Connection unavailable"));

    const response = await fetch(`${baseUrl}/api/health/ready`);

    await expect(response.json()).resolves.toEqual({
      error: "Service Unavailable",
      message: "Database is unavailable",
      statusCode: 503,
    });
    expect(response.status).toBe(503);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith("SELECT 1");
  });
});
