export class INaturalistIntegrationError extends Error {
  readonly kind = "invalid-response";
  readonly provider = "iNaturalist";

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = INaturalistIntegrationError.name;
  }
}
