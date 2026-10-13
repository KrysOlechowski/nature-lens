import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { API_RATE_LIMIT_OPTIONS } from "./request-protection.config.js";

@Module({
  imports: [ThrottlerModule.forRoot(API_RATE_LIMIT_OPTIONS)],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class RequestProtectionModule {}
