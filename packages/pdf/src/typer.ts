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
}
