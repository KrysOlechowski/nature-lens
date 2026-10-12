import { GDOS_PROVIDER } from "./gdos.constants.js";

export class GdosIntegrationError extends Error {
  readonly kind = "invalid-response";
  readonly provider = GDOS_PROVIDER;

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = GdosIntegrationError.name;
  }
}
