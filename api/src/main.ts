import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module.js";
import { environment } from "./config/environment.js";
import { StructuredLogger } from "./logging/structured-logger.js";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(new StructuredLogger());
  app.flushLogs();

  app.set("trust proxy", environment.TRUST_PROXY);
  app.enableShutdownHooks();
  app.enableCors({
    origin: environment.WEB_ORIGIN,
    methods: ["GET"],
    credentials: false,
  });
  app.setGlobalPrefix("api");

  await app.listen(environment.PORT);
}

await bootstrap();
