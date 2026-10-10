import type { ObservationProvider } from "../biodiversity/biodiversity-provider.contract.js";
import type { GBIFObservationResult } from "./gbif.adapter.js";

export const GBIF_OBSERVATION_PROVIDER = Symbol("GBIF_OBSERVATION_PROVIDER");

export type GBIFObservationProvider = ObservationProvider<
  number,
  GBIFObservationResult
>;
