import { OPEN_METEO_PROVIDER } from "./open-meteo.constants.js";

export class OpenMeteoIntegrationError extends Error {
  readonly kind = "invalid-response";
  readonly provider = OPEN_METEO_PROVIDER;

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = OpenMeteoIntegrationError.name;
  }
}
