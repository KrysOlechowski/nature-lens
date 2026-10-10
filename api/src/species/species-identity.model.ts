export type SpeciesIdentityResolutionContextValue =
  string | number | boolean | null;

export interface SpeciesProviderMappingResolution {
  provider: string;
  externalId: string;
  resolutionMethod: string;
  resolutionContext: Record<string, SpeciesIdentityResolutionContextValue>;
}
