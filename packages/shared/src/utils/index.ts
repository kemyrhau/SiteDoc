export { utledMinRolle, utledDokumentRettighet, beregnHarBallen } from "./flytRolle";
export type { FlytBrukerInfo, FlytMedlemInfo, DokumentKontekst, DokumentRettighet, DokumentRettighetInput, HarBallenDokument, HarBallenBruker } from "./flytRolle";
export { hentRolleFiltrertHandlinger, erTillattForRolle, hentHandlingEierRoller, flytRettighetNoekkel, ROLLE_HANDLINGER_DEFAULTS, PROSJEKTADMIN_ROLLE } from "./statusHandlinger";
export type { RettighetsOverrides, AdminNiva } from "./statusHandlinger";
export { vaerkodeTilTekst } from "./vaer";
export { beregnSynligeMapper } from "./mappeTilgang";
export type { MappeTilgangInput, BrukerTilgangInfo, SynligeMapperResultat } from "./mappeTilgang";
export { hentStatusHandlinger } from "./statusHandlinger";
export type { StatusHandling } from "./statusHandlinger";
export { IKKE_SLETTET, KUN_SLETTET, PAPIRKURV_DAGER, dagerIgjen } from "./softDelete";
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
export { perspektivEtikett, utledPerspektiv, kvitteringEtikett } from "./perspektivEtikett";
export type {
  BadgeVariant,
  Perspektiv,
  PerspektivDokumentType,
  PerspektivSeerKontekst,
  PerspektivEtikett,
} from "./perspektivEtikett";

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
    // F2 (D-1): `sent` er transient (auto→received) og har ingen produserbare handlinger.
    // Trekk tilbake flyttet til received→draft; sent→cancelled utgår.
    sent: ["received"],
    // F2: Trekk tilbake → received→draft (redigerbar kladd hos avsender, før mottaker har svart).
    // F5 (Send/Videresend-paring, beslutning 6): `sent` aktiveres der Videresend finnes — Send
    // fram i flyten (mot neste ledd) uten å gå via Under arbeid.
    // F6 (Godkjenn fra Mottatt): `approved` gir en Registrator→Godkjenner-flyt (uten utfører) en
    // direkte godkjenn-vei fra Mottatt — TILLEGG til responded→approved, ikke erstatning.
    received: ["in_progress", "responded", "sent", "cancelled", "dismissed", "draft", "approved"],
    // F3 (Under arbeid): `rejected` og `in_progress` er merget. in_progress-handlingene er
    // Besvar (→responded), Send på nytt (→sent) og Lukk (→closed, arver dagens rejected→closed).
    in_progress: ["responded", "sent", "closed"],
    // F3: Send tilbake ruter DIREKTE til Under arbeid (responded→in_progress) — ingen Gjenoppta.
    // F5: responded→sent ble for-staget i F3 (Send fram fra svar-leddet) — bekreftet her.
    responded: ["approved", "in_progress", "sent"],
    // F5 (Send/Videresend-paring, beslutning 6): Send fram også fra godkjent (der Videresend finnes).
    approved: ["closed", "sent"],
    // F3: `rejected`-oppføringen utgår (merget inn i in_progress). `status` er String —
    // eksisterende `rejected`-rader migreres til `in_progress` ved deploy (se migrering).
    // F4 (Gjenåpne-samling): closed/dismissed/cancelled → draft er ÉN handling (Gjenåpne) —
    // henter et avsluttet dokument tilbake til kladd hos oppretteren. cancelled er legacy.
    closed: ["draft"],
    cancelled: ["draft"],
    // F4: Avvist er ikke lenger terminal — dismissed→draft åpner F1s terminal-status (Gjenåpne).
    dismissed: ["draft"],
  };

  return validTransitions[current]?.includes(next) ?? false;
}

/**
 * Statusoverganger som krever en ikke-tom begrunnelse (F1, gate-JA #2).
 * Bryter bevisst «fritekst = valgfritt»-presedensen — Kenneth-vedtatt: en avvisning
 * skal alltid bære en begrunnelse. Delt kilde for server-validering (Zod-gate i
 * endreStatus) og klient-validering (web + mobil handlingsmeny), så regelen ikke
 * kan divergere mellom lagene.
 */
export function statusKreverBegrunnelse(nyStatus: string): boolean {
  return nyStatus === "dismissed";
}
