import { Module } from "@nestjs/common";
import { environment } from "../config/environment.js";
import { ExternalHttpClient } from "./external-http-client.service.js";
import {
  EXTERNAL_HTTP_FETCH,
  EXTERNAL_HTTP_TIMEOUT_MS,
} from "./external-http.tokens.js";

@Module({
  providers: [
    {
      provide: EXTERNAL_HTTP_FETCH,
      useValue: globalThis.fetch,
    },
    {
      provide: EXTERNAL_HTTP_TIMEOUT_MS,
      useValue: environment.EXTERNAL_HTTP_TIMEOUT_MS,
    },
    ExternalHttpClient,
  ],
  exports: [ExternalHttpClient],
})
export class ExternalHttpModule {}
