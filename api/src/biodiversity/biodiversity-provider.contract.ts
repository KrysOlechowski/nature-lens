export interface SpeciesSearchProvider<TResult> {
  readonly providerName: string;
  searchSpecies(query: string): Promise<TResult[]>;
}

export interface ObservationPageRequest {
  page: number;
  perPage: number;
}

export interface ObservationPage<TResult> {
  totalResults: number;
  page: number;
  perPage: number;
  results: TResult[];
}

export interface ObservationProvider<TExternalSpeciesId, TResult> {
  readonly providerName: string;
  getObservations(
    externalSpeciesId: TExternalSpeciesId,
    pagination: ObservationPageRequest,
  ): Promise<ObservationPage<TResult>>;
}
