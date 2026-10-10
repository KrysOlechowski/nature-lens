export class GBIFIntegrationError extends Error {
  readonly kind = "invalid-response";
  readonly provider = "GBIF";

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = GBIFIntegrationError.name;
  }
}
