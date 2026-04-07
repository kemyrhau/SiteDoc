export { utledMinRolle } from "./flytRolle";
export type { FlytBrukerInfo, FlytMedlemInfo, DokumentKontekst } from "./flytRolle";
export { hentRolleFiltrertHandlinger, erTillattForRolle } from "./statusHandlinger";
export { vaerkodeTilTekst } from "./vaer";
export { beregnSynligeMapper } from "./mappeTilgang";
export type { MappeTilgangInput, BrukerTilgangInfo, SynligeMapperResultat } from "./mappeTilgang";
export { hentStatusHandlinger } from "./statusHandlinger";
export type { StatusHandling } from "./statusHandlinger";
export { beregnTransformasjon, gpsTilTegning, tegningTilGps, erInnenforTegning, beregnKalibreringsFeil } from "./georeferanse";
export type { Transformasjon } from "./georeferanse";
export { utmTilWgs84, ntmTilWgs84, konverterTilWgs84, detekterKoordinatSystem, EPSG_TIL_SYSTEM } from "./koordinatKonvertering";
export type { KoordinatSystem } from "./koordinatKonvertering";
export { wgs84TilUtm, wgs84TilNtm, wgs84TilProjeksjon, gpsTil3D, tredjeTilGps } from "./koordinatBro";
export type { IfcOpprinnelse } from "./koordinatBro";

/**
 * Generer et unikt prosjektnummer med prefiks og sekvensielt nummer.
 * Format: SD-YYYYMMDD-XXXX (f.eks. SD-20260228-0001)
 */
export function generateProjectNumber(sequentialNumber: number): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const seq = String(sequentialNumber).padStart(4, "0");
  return `SD-${date}-${seq}`;
}

/**
 * Sjekk om en dokumentstatus-overgang er gyldig.
 */
export function isValidStatusTransition(
  current: string,
  next: string,
): boolean {
  const validTransitions: Record<string, string[]> = {
    draft: ["sent", "cancelled"],
    sent: ["received", "cancelled"],
    received: ["in_progress", "cancelled"],
    in_progress: ["responded", "sent", "cancelled"],
    responded: ["approved", "rejected"],
    approved: ["closed"],
    rejected: ["in_progress", "closed"],
    closed: [],
    cancelled: ["draft"],
  };

  return validTransitions[current]?.includes(next) ?? false;
}
