import type { ExecutionContext, Type } from "@nestjs/common";
import { APP_GUARD, Reflector } from "@nestjs/core";
import {
  ThrottlerException,
  ThrottlerGuard,
  ThrottlerStorageService,
} from "@nestjs/throttler";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module.js";
import { environment } from "../src/config/environment.js";
import { HealthController } from "../src/health/health.controller.js";
import { API_RATE_LIMIT_OPTIONS } from "../src/request-protection/request-protection.config.js";
import { RequestProtectionModule } from "../src/request-protection/request-protection.module.js";
import { SpeciesController } from "../src/species/species.controller.js";

const activeStorages: ThrottlerStorageService[] = [];

afterEach(() => {
  for (const storage of activeStorages.splice(0)) {
    storage.onApplicationShutdown();
  }
});

describe("request protection", () => {
  it("registers the official throttler as a global guard", () => {
    const imports = Reflect.getMetadata("imports", AppModule) as unknown[];
    const providers = Reflect.getMetadata(
      "providers",
      RequestProtectionModule,
    ) as Array<{ provide?: unknown; useClass?: unknown }>;

    expect(imports).toContain(RequestProtectionModule);
    expect(
      providers.some(
        (provider) =>
          provider.provide === APP_GUARD &&
          provider.useClass === ThrottlerGuard,
      ),
    ).toBe(true);
  });

  it("returns 429 after the global request limit is exceeded", async () => {
    const guard = await createGuard();
    const context = createHttpContext(
      HealthController,
      HealthController.prototype.getHealth,
    );

    for (let hit = 0; hit < environment.API_RATE_LIMIT_REQUESTS; hit += 1) {
      await expect(guard.canActivate(context)).resolves.toBe(true);
    }

    const error = await guard.canActivate(context).catch((cause) => cause);

    expect(error).toBeInstanceOf(ThrottlerException);
    expect((error as ThrottlerException).getStatus()).toBe(429);
  });

  it("enforces the endpoint override before the global limit", async () => {
    expect(environment.API_EXPENSIVE_RATE_LIMIT_REQUESTS).toBeLessThan(
      environment.API_RATE_LIMIT_REQUESTS,
    );

    const guard = await createGuard();
    const context = createHttpContext(
      SpeciesController,
      SpeciesController.prototype.searchSpecies,
    );

    for (
      let hit = 0;
      hit < environment.API_EXPENSIVE_RATE_LIMIT_REQUESTS;
      hit += 1
    ) {
      await expect(guard.canActivate(context)).resolves.toBe(true);
    }

    const error = await guard.canActivate(context).catch((cause) => cause);

    expect(error).toBeInstanceOf(ThrottlerException);
    expect((error as ThrottlerException).getStatus()).toBe(429);
  });
});

async function createGuard(): Promise<ThrottlerGuard> {
  const storage = new ThrottlerStorageService();
  activeStorages.push(storage);
  const guard = new ThrottlerGuard(
    API_RATE_LIMIT_OPTIONS,
    storage,
    new Reflector(),
  );
  await guard.onModuleInit();
  return guard;
}

function createHttpContext(
  controller: Type<unknown>,
  handler: CallableFunction,
): ExecutionContext {
  const request = {
    headers: {},
    ip: "203.0.113.10",
  };
  const response = {
    header: vi.fn(),
  };

  return {
    getClass: () => controller,
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as ExecutionContext;
}
