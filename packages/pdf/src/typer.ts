/**
 * Typer for @sitedoc/pdf — delt mellom web og mobil.
 * Null runtime-avhengigheter.
 */

// ---------------------------------------------------------------------------
//  Rapportobjekter og feltverdier
// ---------------------------------------------------------------------------

export interface RapportObjekt {
  id: string;
  type: string;
  label: string;
  required: boolean;
  config: Record<string, unknown>;
  sortOrder: number;
  parentId: string | null;
}

export interface TreObjekt extends RapportObjekt {
  children: TreObjekt[];
}

export interface Vedlegg {
  id: string;
  type: string;
  url: string;
  filnavn: string;
  opprettet?: string;
  /**
   * Når bildet ble TATT (EXIF DateTimeOriginal), ikke når vedlegget ble lagt i
   * dokumentet (`opprettet`). Innført 2026-09-04. Tre tilstander som STYRER
   * utskriften (se `bildeOpptakTid` i hjelpere):
   *   - `undefined` = nøkkelen finnes ikke ⇒ vedlegg lagd før feltet ⇒ vis
   *     historisk `opprettet` (endrer ikke arkiverte dokumenter).
   *   - `null` (eller "") = nytt bilde uten EXIF-tid ⇒ «Tidspunkt ikke tilgjengelig».
   *   - ISO-streng ⇒ vis opptakstidspunktet.
   */
  opptakTidspunkt?: string | null;
  /**
   * Løpende bildenummer tildelt i appen ved opptak (vedtak 2026-08-16), synlig
   * for brukeren og refererbart i tekst. Utskriften rendrer dette LAGREDE
   * nummeret; mangler det (arkiverte dokumenter fra før feltet), faller dokgen
   * tilbake til dokumentrekkefølge. Dokgen teller aldri selv når feltet finnes.
   */
  bildeNr?: number;
}

export interface FeltVerdi {
  verdi: unknown;
  kommentar: string;
  vedlegg: Vedlegg[];
}

/**
 * Repeater-RAD (rad-id-vedtak 2026-08-22, variant OMSLUTTING): `{ _radId, felter }`, ikke en
 * naken `Record`. `_radId` er en STABIL id (uuid) tildelt i utfyllingsflaten (web/mobil) og bevart
 * gjennom redigering/sletting — fundamentet for persistente rad-scopede oppgaver (indeks brekker
 * ved radsletting). PDF/api LESER kun (rendring) og bruker aldri id-en; der normaliseres gamle
 * rader med tom id. Typen er deklarert LOKALT per pakke (packages/pdf importerer bevisst ikke
 * @sitedoc/shared, felt.ts:79) — hver pakke håndhever sine egne rad-tilgangssteder.
 */
export interface Rad {
  _radId: string;
  felter: Record<string, FeltVerdi>;
}

/**
 * Normaliser en rå repeater-rad til `{ _radId, felter }`. Bakoverkompat (migrer-ved-lesing):
 * gammel form (naken `Record<string, FeltVerdi>`) omsluttes. PDF/api bruker ikke `_radId` →
 * tom id her (den ekte uuid-en tildeles i web/mobil ved opprettelse/lesing og persisteres der).
 */
export function normaliserRad(raa: unknown): Rad {
  if (raa && typeof raa === "object" && "felter" in raa) return raa as Rad;
  return { _radId: "", felter: (raa ?? {}) as Record<string, FeltVerdi> };
}

export interface VaerVerdi {
  temp?: string;
  conditions?: string;
  wind?: string;
  precipitation?: string;
  kilde?: "manuell" | "automatisk";
}

// ---------------------------------------------------------------------------
//  Dokument-typer for PDF-generering
// ---------------------------------------------------------------------------

export interface SjekklisteForPdf {
  id: string;
  title: string;
  status: string;
  number?: number | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  template: {
    name: string;
    prefix?: string | null;
    objects: RapportObjekt[];
  };
  creator?: { name?: string | null } | null;
  bestillerFaggruppe?: { name: string } | null;
  utforerFaggruppe?: { name: string } | null;
  bestiller?: { name?: string | null } | null;
  building?: { name: string } | null;
  drawing?: { name: string; drawingNumber?: string | null; imageWidth?: number | null; imageHeight?: number | null } | null;
  drawingId?: string | null;
  positionX?: number | null;
  positionY?: number | null;
  changeLog?: Array<{ createdAt: Date | string; user: { name: string | null } }>;
}

export interface OppgaveForPdf {
  id: string;
  title: string;
  status: string;
  priority: string;
  description?: string | null;
  number?: number | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  template: {
    name: string;
    prefix?: string | null;
    objects: RapportObjekt[];
    showPriority?: boolean;
  };
  creator?: { name?: string | null } | null;
  bestillerFaggruppe?: { name: string } | null;
  utforerFaggruppe?: { name: string } | null;
  bestiller?: { name?: string | null } | null;
  drawing?: {
    name: string;
    drawingNumber?: string | null;
    fileUrl?: string | null;
    byggeplass?: { name: string } | null;
  } | null;
  drawingId?: string | null;
  positionX?: number | null;
  positionY?: number | null;
  changeLog?: Array<{ createdAt: Date | string; user: { name: string | null } }>;
}

export interface ProsjektForPdf {
  name: string;
  projectNumber?: string | null;
  externalProjectNumber?: string | null;
  // Internt prosjektnummer (entreprenørens eget system — ERP/Pro Admin). Vises i
  // utskrift-referansekjeden mellom eksternt og SD. Se terminologi.md § Tre prosjektnumre.
  internalProjectNumber?: string | null;
  // Gater SiteDoc-nummeret (SD) som siste utvei i utskrift-referansen. Default true.
  // (Prisma-felt visSiteDocNummer; kolonnen heter fortsatt show_internal_project_number.)
  visSiteDocNummer?: boolean | null;
  address?: string | null;
  logoUrl?: string | null;
}

// ---------------------------------------------------------------------------
//  Utskriftsinnstillinger (lagret på prosjekt)
// ---------------------------------------------------------------------------

export interface Utskriftsinnstillinger {
  logo?: boolean;
  eksternProsjektnummer?: boolean;
  prosjektnavn?: boolean;
  fraTil?: boolean;
  lokasjon?: boolean;
  tegningsnummer?: boolean;
  vaer?: boolean;
}

// ---------------------------------------------------------------------------
//  Plattform-konfigurasjon
// ---------------------------------------------------------------------------

export interface PdfConfig {
  /** Base-URL for bilder (web: "/api", mobil: "https://api-test.sitedoc.no") */
  bildeBaseUrl: string;
  /** Maks bildehøyde i px (default 260) */
  maksbildeHoyde?: number;
  /** Vis gjentakende header+footer via table-layout (kun web) */
  gjentakendeHeader?: boolean;
  /** CSS sidenummer via counter (kun web browser print) */
  visSidenummer?: boolean;
  /** Tegningsbilde-URL for posisjon (pre-rendret, valgfri) */
  tegningBildeUrl?: string | null;
  /** Screenshot av tegning med prikk (base64 data-URL, brukes i stedet for posisjon) */
  tegningScreenshot?: string | null;
  /** Pre-croppet detalj-utsnitt (base64 data-URL, generert av cropScreenshot) */
  tegningDetaljScreenshot?: string | null;
  /**
   * Arkivmal (opt-in, default av → mobil uendret): vis tomme strukturer i
   * stedet for å skjule dem. Tom `repeater` → «Ingen rader registrert»,
   * tomt `attachments` → «Ingen vedlegg». For byggherre-dokumentasjon skal en
   * tom kontrolltabell ikke forsvinne stille (cowork 2026-08-13).
   */
  visTommeStrukturer?: boolean;
  /**
   * Arkiv-only (opt-in, default av → mobil uendret): oppslag `drawingId` →
   * inlinet tegningsbilde (data-URI) + dimensjoner, som lar arkivstien rendre
   * `drawing_position`/dokument-lokasjon via `byggTegningPosisjon`. Bildet er
   * ALLEREDE inlinet til data-URI av api-sammenstillingen (nettverksfri
   * container) — aldri en signert URL. Mobil setter aldri dette.
   */
  tegningsOppslag?: Record<string, TegningsOppslagOppf>;
  /**
   * Arkiv-only (opt-in): oppslag `objektId` (rapportobjektets id) →
   * signaturliste-data (runder/deltakere/signaturer). Lar felt-rendereren
   * bygge signaturtabellen for `signature_list`, som ikke bærer verdien i
   * `felt.verdi` men i egne tabeller. Api-sammenstillingen fyller dette.
   */
  signaturOppslag?: Record<string, SignaturListeData>;
  /** Arkiv-only: inkluder full runde-logg under signaturtabellen («Med logg»). */
  signaturMedLogg?: boolean;
  /** Arkiv-only: tidspunktet PDF-en genereres (ISO) — vises i signatur-topplinja. */
  signaturGenerertTidspunkt?: string;
}

// ---------------------------------------------------------------------------
//  Signaturliste (SJA/HMS-runder) — arkiv-PDF-data
// ---------------------------------------------------------------------------

export interface SignaturListeDeltakerData {
  id: string;
  navn: string;
  firma: string | null;
  erGjest: boolean;
  /** Aktiv nå (ikke fjernet). Fjernet+signert vises fortsatt (forrige-runde-rad). */
  aktiv: boolean;
}

export interface SignaturListeSignaturData {
  deltakerId: string;
  hmsKortNr: string | null;
  harIkkeHmsKort: boolean;
  /** Server-tidspunkt (UTC ISO) — fallback for visning. */
  completedAt: string | null;
  /** Lokal ISO-8601 med offset (klientens veggklokke) — foretrukket for visning. */
  signertTidspunkt: string | null;
}

export interface SignaturListeRundeData {
  rundeNr: number;
  startetAt: string | null;
  avsluttetAt: string | null;
  aarsak: string | null;
  erGjeldende: boolean;
  signaturer: SignaturListeSignaturData[];
}

export interface SignaturListeData {
  /** «X av Y signert» for gjeldende runde (frys-bevisst — regnet i api-laget). */
  status: { signert: number; av: number; rundeNr: number | null };
  deltakere: SignaturListeDeltakerData[];
  runder: SignaturListeRundeData[];
}

/** Én oppføring i `PdfConfig.tegningsOppslag` — inlinet tegningsbilde + metadata. */
export interface TegningsOppslagOppf {
  /** Inlinet tegningsbilde som `data:image/…;base64,…` (aldri nettverks-URL). */
  dataUrl: string;
  imageWidth?: number | null;
  imageHeight?: number | null;
  /** Tegningsnavn (m/ evt. tegningsnummer) for blokk-tittel. */
  navn?: string | null;
}
