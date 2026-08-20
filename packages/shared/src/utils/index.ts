export { utledMinRolle, utledDokumentRettighet, beregnHarBallen } from "./flytRolle";
export type { FlytBrukerInfo, FlytMedlemInfo, DokumentKontekst, DokumentRettighet, DokumentRettighetInput, HarBallenDokument, HarBallenBruker } from "./flytRolle";
export { hentRolleFiltrertHandlinger, erTillattForRolle, hentHandlingEierRoller, flytRettighetNoekkel, ROLLE_HANDLINGER_DEFAULTS, PROSJEKTADMIN_ROLLE } from "./statusHandlinger";
export type { RettighetsOverrides, AdminNiva } from "./statusHandlinger";
export { vaerkodeTilTekst, finnVaerTimeIndeks, byggVaerSnapshot } from "./vaer";
export type { VaerHourly, VaerSnapshot } from "./vaer";
export { nesteBildeNr, nummererRepeaterBilder } from "./bildeNr";
export { beregnSynligeMapper } from "./mappeTilgang";
export type { MappeTilgangInput, BrukerTilgangInfo, SynligeMapperResultat } from "./mappeTilgang";
export { hentStatusHandlinger, hentPosisjonFiltrertHandlinger } from "./statusHandlinger";
export type { StatusHandling, PosisjonHandlingKontekst } from "./statusHandlinger";
export { IKKE_SLETTET, KUN_SLETTET, PAPIRKURV_DAGER, dagerIgjen } from "./softDelete";
export { GRATIS_DOKUMENT_GRENSE, grenseNaadd } from "./prosjektGrense";
export type { GrenseVilkaar } from "./prosjektGrense";
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
export {
  nesteLedd,
  forrigeBallLedd,
  avledStatus,
  harBallenPosisjon,
  retningsrettigheter,
  finnPosisjon,
  gjenapnePosisjon,
  byggPosisjonsLedd,
  utledMottakerForPosisjon,
  ansvarsmerkeKey,
  seerErBakover,
  erAvsenderledd,
  erMedlemAvFlyt,
} from "./flytPosisjon";
export type {
  LeddKlassifisering,
  FlytPosisjonLedd,
  FlytBruker,
  AvledStatusFakta,
  AvledetVisning,
  RaFlytMedlem,
  Mottaker,
} from "./flytPosisjon";
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
export { finnSedlerÅSlette } from "./timerSyncSletting";
export type { Slettevindu, LokalSedelUtsnitt } from "./timerSyncSletting";
export { carveArbeidstider } from "./carveArbeidstid";
export type { CarveSegment, CarvetVindu } from "./carveArbeidstid";
export {
  harFeltVerdi,
  beregnLaasteFelter,
  erUtfyllbartFelt,
  feltErBesvart,
  harMinstEttUtfyltFelt,
  IKKE_UTFYLLBARE_FELTTYPER,
} from "./feltLaasing";
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
export {
  UTLEGG_ORDNINGER,
  erGyldigOrdning,
  utledOrdning,
  baeresAvSheetUtlegg,
  krevesBelop,
  kreverKvittering,
  tillaterKvittering,
  eksportRute,
} from "./utleggOrdning";
export type {
  UtleggOrdning,
  UtledOrdningInput,
  EksportRute,
} from "./utleggOrdning";
export {
  LAGRING_MODELLER,
  DB_SNITT_BYTES,
  tomModellSum,
  aggregerLagring,
  dbVolumEstimatBytes,
  manglerStorrelsePerModell,
  formaterBytes,
} from "./lagring";
export type {
  LagringModell,
  LagringRad,
  ModellSum,
  ProsjektAggregat,
} from "./lagring";

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
    // Fase 3.6 (2026-08-01, fabel-løsning 1): `received→sent` GJENINNFØRT. §8A fjernet den fordi den
    // var en recipient-løs no-op i den GAMLE modellen; posisjonsmodellen (Fase 3) ruter `sent→nesteLedd`
    // (ignorerer recipient-input, aldri no-op) og guarder med `verifiserRetningsrett` (kun ball-holder),
    // så «Send → = neste ledd» (veileder § 2.2) gir mening fra ETHVERT ledd — dette FULLFØRER P1, reverserer
    // den ikke. Simulator-fasit: 1 Send→2, 2 Send→3, 3 Send→4. UI-tilbudet (statusHandlinger/flytmatrise-def)
    // holdes URØRT til Fase 4 steg 4 wirer «Send til N·X →» fra received → dormant/additiv kapabilitet her.
    // responded→sent + approved→sent forblir fjernet (responded=besvart/tilbake, approved=terminal H6).
    // F6 (Godkjenn fra Mottatt): `approved` gir en Registrator→Godkjenner-flyt (uten utfører) en
    // direkte godkjenn-vei fra Mottatt — TILLEGG til responded→approved, ikke erstatning.
    // Runde-2 (2026-08-02): `in_progress` kollapset HELT (Q1=A) — fjernet som mål fra received (nås
    // aldri) og som kilde (in_progress-nøkkelen utgår). avledStatus gir alltid received/«Hos N».
    received: ["responded", "cancelled", "dismissed", "draft", "approved", "sent"],
    // Pilot-fiks B (2026-08-02, fabel-bindende): `responded→sent` GJENINNFØRT — samme klasse som
    // Fase 3.6 `received→sent`. Et kontroll-ledд som mottar Besvar og IKKE er siste ledд skal Sende
    // FRAMOVER (nesteLedd, ball-guardet via verifiserRetningsrett), ikke Godkjenne. Ruter via
    // posisjon (aldri recipient-løs no-op — det var §8A-bekymringen i den GAMLE modellen).
    // Runde-2 (2026-08-02): `responded→in_progress` («Send tilbake») FJERNET — bakover er nå Besvar ←
    // (fra received), én bakover-vei. `in_progress` kollapses HELT (Q1=A) og skrives aldri.
    responded: ["approved", "sent"],
    // §8A-fiks (2026-07-29): `approved→sent` FJERNET — samme recipient-løse no-op.
    // H6 (Godkjent = stoppsted): approved lukkes ALDRI — approved→closed fjernet. Veien tilbake er
    // Gjenåpne (approved→draft, Reg + P-adm, § 4).
    approved: ["draft"],
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
 * Statusoverganger som krever en ikke-tom begrunnelse/kommentar.
 *
 * Bryter bevisst «fritekst = valgfritt»-presedensen. P2 (Kenneth-vedtak 2026-07-21,
 * valg B) utvidet fra kun `dismissed` (Avvis, F1) til hele kommentar-klassen:
 *   - `dismissed`   — Avvis (F1)
 *   - `in_progress` — Send tilbake (responded→in_progress, F3)
 *   - `responded`   — Besvar
 * Videresend (`forwarded`) og Send (`sent`) er UNNTAK — krever ikke kommentar.
 * Hver mål-status er enekilde til sin handling (målt Ledd 1), så `nyStatus` alene
 * skiller rent uten per-flate if-er.
 *
 * Delt kilde for server-validering (Zod-gate i endreStatus) og klient-validering
 * (web + mobil handlingsmeny), så regelen ikke kan divergere mellom lagene.
 */
// Runde-2 (2026-08-02): `in_progress` («Send tilbake») fjernet fra klassen — handlingen finnes ikke mer.
const STATUS_KREVER_BEGRUNNELSE: ReadonlySet<string> = new Set([
  "dismissed",
  "responded",
]);

export function statusKreverBegrunnelse(nyStatus: string): boolean {
  return STATUS_KREVER_BEGRUNNELSE.has(nyStatus);
}
