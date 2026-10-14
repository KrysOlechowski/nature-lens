import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { environment } from "./config/environment.js";
import { StructuredLogger } from "./logging/structured-logger.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(new StructuredLogger());
  app.flushLogs();

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
