import type {
  ObservationProvider,
  SpeciesSearchProvider,
} from "../biodiversity/biodiversity-provider.contract.js";
import type {
  INaturalistObservationResult,
  INaturalistSpeciesSearchResult,
} from "./inaturalist.adapter.js";

export const INATURALIST_SPECIES_SEARCH_PROVIDER = Symbol(
  "INATURALIST_SPECIES_SEARCH_PROVIDER",
);
export const INATURALIST_OBSERVATION_PROVIDER = Symbol(
  "INATURALIST_OBSERVATION_PROVIDER",
);
export const INATURALIST_HTTP_POLICY = Symbol("INATURALIST_HTTP_POLICY");

export type INaturalistSpeciesSearchProvider =
  SpeciesSearchProvider<INaturalistSpeciesSearchResult>;
export type INaturalistObservationProvider = ObservationProvider<
  number,
  INaturalistObservationResult
>;
