import { NOMINATIM_PROVIDER } from "./nominatim.constants.js";

export class NominatimIntegrationError extends Error {
  readonly kind = "invalid-response";
  readonly provider = NOMINATIM_PROVIDER;

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = NominatimIntegrationError.name;
  }
}
