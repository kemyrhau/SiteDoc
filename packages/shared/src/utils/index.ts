export { utledMinRolle, utledDokumentRettighet, beregnHarBallen } from "./flytRolle";
export type { FlytBrukerInfo, FlytMedlemInfo, DokumentKontekst, DokumentRettighet, DokumentRettighetInput, HarBallenDokument, HarBallenBruker } from "./flytRolle";
export { hentRolleFiltrertHandlinger, erTillattForRolle, hentHandlingEierRoller } from "./statusHandlinger";
export { vaerkodeTilTekst } from "./vaer";
export { beregnSynligeMapper } from "./mappeTilgang";
export type { MappeTilgangInput, BrukerTilgangInfo, SynligeMapperResultat } from "./mappeTilgang";
export { hentStatusHandlinger } from "./statusHandlinger";
export type { StatusHandling } from "./statusHandlinger";
export { beregnTransformasjon, gpsTilTegning, tegningTilGps, erInnenforTegning, beregnKalibreringsFeil, beregnByggeplassGeofence, avstandMeter } from "./georeferanse";
export type { Transformasjon } from "./georeferanse";
export { klassifiserReise, estimerReisetidMin } from "./reise";
export type { ReiseKategori, ReiseRegelsett } from "./reise";
export { utmTilWgs84, ntmTilWgs84, konverterTilWgs84, detekterKoordinatSystem, EPSG_TIL_SYSTEM } from "./koordinatKonvertering";
export type { KoordinatSystem } from "./koordinatKonvertering";
export { wgs84TilUtm, wgs84TilNtm, wgs84TilProjeksjon, gpsTil3D, tredjeTilGps } from "./koordinatBro";
export type { IfcOpprinnelse } from "./koordinatBro";
export { kompetanseStatus } from "./kompetanseStatus";
export type { KompetanseStatus } from "./kompetanseStatus";
export { normaliserRegnummer, erGyldigRegnummer } from "./regnummer";
export { resolverNyNavigasjon } from "./nyNavigasjon";
export type { NyNavigasjonKilde } from "./nyNavigasjon";
export {
  EPSILON_MASKIN_TIMER,
  maskinBucketNokkel,
  overstigerMaskinTak,
  maskinBucketKapasitet,
  beregnMaskinBrudd,
} from "./maskinKapasitet";
export type { MaskinKapasitetRad, MaskinBrudd } from "./maskinKapasitet";
export {
  OVERTID_NIVAA_50,
  OVERTID_NIVAA_100,
  klassifiserArbeidstid,
  velgOvertidLonnsart,
} from "./lonnsregel";
export type { ArbeidstidSegment, OvertidLonnsartKandidat } from "./lonnsregel";
export {
  DEFAULT_PAUSE_ETTER_TIMER,
  pauseVinduFra,
  hhmmTilMin,
  minTilHhmm,
  pauseOverlappMin,
  effektiveTimerFraSpenn,
  tilFraAntall,
  PAUSE_TERSKEL_TIMER,
  pauseMinForDag,
} from "./pauseBeregning";
export {
  tilErEtterFra,
  tidsromOverlapper,
  finnOverlappendeTidsrom,
  finnTidsromKonflikt,
} from "./tidsromValidering";
export type { Tidsrom, TidsromKonflikt } from "./tidsromValidering";
export { carveArbeidstider } from "./carveArbeidstid";
export type { CarveSegment, CarvetVindu } from "./carveArbeidstid";
export { harFeltVerdi, beregnLaasteFelter } from "./feltLaasing";
export { avgjorDokumentTilgang } from "./avgjorDokumentTilgang";
export type { TilgangsFakta, TilgangsResultat } from "./avgjorDokumentTilgang";
export {
  normaliserGrense,
  harGrense,
  grenseStatus,
  formaterGrense,
} from "./grenseSjekk";
export type { Grense, GrenseStatus } from "./grenseSjekk";
export { grupperMedOverskrift } from "./seksjoner";
export type { Seksjon } from "./seksjoner";

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
    received: ["in_progress", "responded", "cancelled"],
    in_progress: ["responded", "sent", "cancelled"],
    responded: ["approved", "rejected"],
    approved: ["closed"],
    rejected: ["in_progress", "closed"],
    closed: [],
    cancelled: ["draft"],
  };

  return validTransitions[current]?.includes(next) ?? false;
}
