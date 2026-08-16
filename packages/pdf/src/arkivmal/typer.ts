/**
 * Arkivmal — delte typer for datalaget (RENT LAG, ingen Prisma).
 *
 * ARKITEKTUR-GRENSE (gatet av cowork 2026-08-12):
 * - Dette laget tolker `utskriftsinnstillinger` (§1) og former logg-DTO-er.
 *   Det er avhengighetsfritt — mobil importerer `@sitedoc/pdf`, så Prisma
 *   kan ALDRI inn her.
 * - Prisma-lesingen bor i `apps/api/src/services/arkiv/` (leserne). Api leser
 *   data + bygger HTML; rendrer-containeren er en ren HTML→PDF-konverter uten
 *   databasetilgang.
 */

import type { Utskriftsinnstillinger } from "../typer";

/** Kilde for en hendelsesrad (lag 1). */
export type ArkivHendelseKilde = "transfer" | "kommentar";

/**
 * Lag 1 — Hendelseslogg (`DocumentTransfer` + `TaskComment`). ALLTID til
 * stede; dette er sporbarhetsminimumet byggherren skal se (§3-korreksjon).
 */
export interface HendelseRad {
  /** ISO-8601 tidsstempel (createdAt). */
  tidspunkt: string;
  /** Navn på den som utførte hendelsen (sender/kommentator). */
  aktor: string;
  /** Snapshot-rolle ved hendelsestidspunktet (bestiller|utforer|godkjenner|registrator). */
  aktorRolle?: string | null;
  /** Menneskevennlig handling, avledet av fromStatus→toStatus. */
  handling: string;
  fraStatus?: string | null;
  tilStatus?: string | null;
  /** Mottaker: bruker-navn ?? gruppe-navn ?? firma-snapshot. */
  til?: string | null;
  /** Dokumentflyt-navn (snapshot ved hendelsestidspunkt). */
  flyt?: string | null;
  /** Kommentar (`DocumentTransfer.comment` el. `TaskComment.content`). */
  kommentar?: string | null;
  kilde: ArkivHendelseKilde;
  /**
   * Antall feltendringer tilordnet denne hendelsen (kryssreferanse-hale
   * «N feltendringer — se Endringslogg»). 0 → halen utelates ved render.
   */
  antallFeltendringer: number;
}

/** Én rad i lag 2 — Endringslogg (feltdiff). */
export interface EndringRad {
  tidspunkt: string;
  felt: string;
  fraVerdi: string | null;
  tilVerdi: string | null;
}

/**
 * Lag 2 gruppert per ØKT = (person, dag). To endringer samme dag av samme
 * person hører i samme økt — grupperingsnøkkel er `(userId, dato)`, dato
 * ikke tidsstempel (fabel-vedtak 2026-08-12).
 */
export interface EndringsØkt {
  userId: string;
  aktor: string;
  /** Dato YYYY-MM-DD. */
  dato: string;
  rader: EndringRad[];
}

/** Rå feltendring fra leser — flat, før gruppering. */
export interface RåEndring {
  userId: string;
  aktor: string;
  tidspunkt: string;
  /** `fieldId` (objekt-id) — slår opp repeater-kolonner ved lesbar-ekspandering. */
  feltId?: string;
  felt: string;
  fraVerdi: string | null;
  tilVerdi: string | null;
}

/** Kontrollplan — punkt-historikk (`KontrollplanHistorikk`, PUNKT-nivå). */
export interface PunktRad {
  tidspunkt: string;
  aktor: string;
  /** opprettet | startet | utfort | godkjent | avvist | endret. */
  handling: string;
  kommentar?: string | null;
  /** Områdenavn · malnavn (best-effort). */
  punktLabel?: string | null;
}

/** Timer/utlegg — revisjon (`SheetRadHistorikk`, snapshot-form). */
export interface RevisjonRad {
  /** `erstattetVed` (ISO). */
  tidspunkt: string;
  /** `erstattetAvUserId` → navn (svak FK, cross-schema oppslag). */
  aktor: string;
  /** timer | tillegg | maskin. */
  radType: string;
  /** Snapshot av rad-tilstanden som ble erstattet. */
  snapshot: Record<string, unknown>;
}

/** Statusblokkens femte felt «Sist endret — {navn}, {dato}». */
export interface SistEndret {
  navn: string;
  /** ISO. */
  dato: string;
}

/**
 * Felles logg-konvolutt — separate lister på felles ISO-tidsakse. Bygget så
 * det tåler BEGGE fabel-utfall: én sammenslått tabell (triviell fletting) ELLER
 * to seksjoner. Per bærer fylles kun de relevante feltene.
 */
export interface ArkivLogg {
  /** Lag 1 — checklist/task/hms. */
  hendelser?: HendelseRad[];
  /** Lag 2 gruppert — checklist/task/hms. Tom når endringslogg av. */
  økter?: EndringsØkt[];
  /** `template.enableChangeLog` — styrer om lag 2 finnes. */
  endringsloggAktivert?: boolean;
  /** Kontrollplan. */
  punkter?: PunktRad[];
  /** Kontrollplan plan-nivå er ulogget → «ærlig linje» ved render. */
  planNivaaUlogget?: boolean;
  /** Timer/utlegg. */
  revisjoner?: RevisjonRad[];
  /** Statusblokkens femte felt (null når ingen logg finnes). */
  sistEndret?: SistEndret | null;
}

// ---------------------------------------------------------------------------
//  Ramme-byggeklosser (Stage 1) — dokumentets faste rammer
// ---------------------------------------------------------------------------

/** De seks innholdsvariantene, valgt av dokumentets `category`. */
export type ArkivKategori =
  | "sjekkliste"
  | "oppgave"
  | "hms"
  | "kontrollplan"
  | "timer"
  | "utlegg";

/** Eksportfirmaet (topptekst). Logo inline som data-URI — containeren har ingen disk/nett. */
export interface ArkivFirma {
  navn: string;
  orgnr?: string | null;
  logoDataUrl?: string | null;
}

/** Dokument-identitet (topptekst + sporbarhet). */
export interface ArkivDokumentMeta {
  kategori: ArkivKategori;
  /** Vises uppercase i topptekstens type-etikett, f.eks. «Sjekkliste», «RUH». */
  dokumenttype: string;
  dokumentnavn: string;
  /** Menneskevendt dokumentnr., f.eks. «SJ-2026-0142». */
  dokumentnummer: string;
  /** Systemets id — sporbarhet i bunntekst, kan ikke velges bort (§4). */
  dokumentId: string;
  /** Rå status-nøkkel (STATUS_TEKST/semantisk farge utledes). */
  status: string;
}

/** Prosjektblokk — tre kolonner, komprimeres når felt slås av (ikke tomrom). */
export interface ArkivProsjektblokk {
  prosjekt?: string | null;
  byggeplass?: string | null;
  byggherre?: string | null;
}

/**
 * Én celle i statusblokken. Varianten leverer sine celler (sjekkliste:
 * Status/Utført av/Utført dato/Godkjent dato; RUH: Status/Meldt av/…).
 * «Sist endret» legges til av sammenstillingen når logg finnes.
 */
export interface StatusCelle {
  etikett: string;
  verdi: string;
  /** Grå tilleggstekst etter verdien, f.eks. «(bas)» eller dato-delen. */
  underVerdi?: string | null;
  /** Semantisk farge på verdien (grønn godkjent, rød avvik). Utledes av status når utelatt. */
  farge?: string | null;
}

/**
 * Signaturfelt (Stage 3). Reelle signaturdata gjengis; mangler signatur →
 * åpen strek. `verb` = «signert» (sjekkliste/SJA) el. «registrert» (RUH).
 */
export interface ArkivSignatur {
  /** «Utført av» · «Godkjent av» · «Meldt av» · «Lukket av». */
  rolleEtikett: string;
  navn: string;
  rolle?: string | null;
  /** ISO — «{verb} i SiteDoc {dato} {tid}». Null → åpen strek (ikke signert). */
  tidspunkt?: string | null;
  verb?: "signert" | "registrert";
}

/** Full sammenstillings-input for arkivdokumentet (Stage 3, sjekkliste/oppgave/HMS). */
export interface ArkivDokumentInput {
  firma: ArkivFirma;
  meta: ArkivDokumentMeta;
  prosjektblokk: ArkivProsjektblokk;
  /** Variant-spesifikke statusceller (Status først, med semantisk farge). */
  statusCeller: StatusCelle[];
  /** Ferdig innhold-HTML (fra byggInnhold — kalleren inliner bilder som data-URI). */
  innholdHtml: string;
  logg: ArkivLogg;
  signaturer: ArkivSignatur[];
  /** «11.08.2026 14:32» — generert-stempel. */
  generertTekst: string;
  innstillinger?: Utskriftsinnstillinger | null;
  /** Eksportpakke → sidetall tvinges på. */
  eksport?: boolean;
  /** Løpende utskrift: prosjektets sidetall-valg (fra PdfConfig). */
  visSidenummer?: boolean;
  /**
   * Krav #2 (vedtak «logg alltid på, velges ved utskrift»): default true.
   * false → Endringslogg (lag 2) utelates ved denne utskriften. Lag 1
   * (Dokumenthistorikk) kan aldri velges bort.
   */
  taMedEndringslogg?: boolean;
  /**
   * Vedtak (c): filnavn på vedlegg som IKKE kom med (bilde-lasting feilet).
   * Rendres som utvetydig mangel-merknad → dokumentet leses aldri som komplett
   * når det ikke er det. Fylles av api-/container-laget.
   */
  manglendeVedlegg?: string[];
}
