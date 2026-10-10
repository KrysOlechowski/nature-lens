import type {
  ObservationProvider,
  TaxonMatchProvider,
} from "../biodiversity/biodiversity-provider.contract.js";
import type {
  GBIFObservationResult,
  GBIFTaxonMatchResult,
} from "./gbif.adapter.js";

export const GBIF_OBSERVATION_PROVIDER = Symbol("GBIF_OBSERVATION_PROVIDER");
export const GBIF_TAXON_MATCH_PROVIDER = Symbol("GBIF_TAXON_MATCH_PROVIDER");

export type GBIFObservationProvider = ObservationProvider<
  number,
  GBIFObservationResult
>;
export type GBIFTaxonMatchProvider = TaxonMatchProvider<GBIFTaxonMatchResult>;
