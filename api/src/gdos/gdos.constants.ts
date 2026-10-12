export const GDOS_PROVIDER = "GDOŚ";

export const GDOS_PROTECTED_AREA_TYPE_NAMES = [
  "GDOS:ParkiNarodowe",
  "GDOS:ParkiKrajobrazowe",
  "GDOS:Rezerwaty",
  "GDOS:ObszaryChronionegoKrajobrazu",
  "GDOS:SpecjalneObszaryOchrony",
  "GDOS:ObszarySpecjalnejOchrony",
  "GDOS:UzytkiEkologiczne",
  "GDOS:ZespolyPrzyrodniczoKrajobrazowe",
  "GDOS:StanowiskaDokumentacyjne",
  "GDOS:PomnikiPrzyrodyPowierzchniowe",
] as const;

export const MAX_PROTECTED_AREAS_PER_VIEWPORT = 200;
export const GDOS_PROTECTED_AREA_FETCH_LIMIT =
  MAX_PROTECTED_AREAS_PER_VIEWPORT + 1;
