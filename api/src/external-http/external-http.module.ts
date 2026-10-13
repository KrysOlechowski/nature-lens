import { Module } from "@nestjs/common";
import { ExternalHttpClient } from "./external-http-client.service.js";
import {
  EXTERNAL_HTTP_DELAY,
  EXTERNAL_HTTP_FETCH,
  EXTERNAL_HTTP_RANDOM,
} from "./external-http.tokens.js";

@Module({
  providers: [
    {
      provide: EXTERNAL_HTTP_FETCH,
      useValue: globalThis.fetch,
    },
    {
      provide: EXTERNAL_HTTP_DELAY,
      useValue: (delayMs: number) =>
        new Promise<void>((resolve) => setTimeout(resolve, delayMs)),
    },
    {
      provide: EXTERNAL_HTTP_RANDOM,
      useValue: Math.random,
    },
    ExternalHttpClient,
  ],
  exports: [ExternalHttpClient],
})
export class ExternalHttpModule {}
