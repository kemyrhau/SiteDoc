/**
 * Arkivmal — render-orkestrator (api-siden).
 *
 * Kjeder: byggSjekklisteArkivHtml (per dokument: `.ark-side` m/ inlinede bilder)
 * → samle N sider til ÉN HTML (byggArkivSamling) → per-side header/footer-
 * templates → POST til pdf-render-containeren (PDF_URL) → PDF-bytes +
 * fullstendighets-signal. Containeren er en ren konverter (ingen DB, ingen
 * secret); denne fila eier data-hentingen og leveringen.
 *
 * N1 (samleutskrift): payloaden er alltid en liste. Ett dokument = liste med ett
 * element (identisk med tidligere oppførsel). Flere = én sammenhengende PDF, men
 * mangel-kontrakten holdes PER dokument i `dokumenter[]`.
 *
 * Fullstendighet slås sammen fra to kilder:
 *   1. `manglendeVedlegg` per dokument — bilder som ikke lot seg lese fra disk.
 *   2. `x-render-komplett: false` fra containeren — canvas/pdfjs ble ikke ferdig
 *      innen tidsvakten (gjelder hele PDF-en).
 */
import { byggArkivSamling } from "@sitedoc/pdf";
import { PDFDocument } from "pdf-lib";
import { byggSjekklisteArkivHtml, byggOppgaveArkivHtml, type RammeData, type SammenstillingResultat, type SammenstillingOpts, type PdfVedleggRef } from "./sammenstilling";
import type { OppgaveTilgang } from "./oppgave-henvisning";
import { hentBildeBytesFraDisk } from "./disk-bilde";
import { byggRenderHeader, byggRenderFooter } from "./render-templates";
import type { PrismaClient } from "@sitedoc/db";

// PDF_URL er base-URL til containeren (compose: http://pdf-render:3304); /pdf
// føyes til her, samme mønster som oversettelse-service kaller /translate.
const PDF_BASE_URL = process.env.PDF_URL || "http://pdf-render:3304";

/**
 * «14.08.2026 14:32» — generert-stempel til PDF-footeren, kort norsk format.
 *
 * 🔴 `timeZone: "Europe/Oslo"` er påkrevd: api-serveren kjører i `Etc/UTC`, så
 * uten eksplisitt sone ble footer-tiden 2t bak norsk sommertid (funn 2026-09-02).
 * Samme avgrensning som `PDF_TIDSSONE` i @sitedoc/pdf — én PDF kan spenne over
 * flere firma, så én firma-sone er tvetydig her; Oslo stopper blødningen.
 *
 * Én kilde: både tRPC-ruten (interaktiv nedlasting) og eksport-arkivet (fase 3)
 * bruker denne, så stempelformatet ikke drifter mellom de to veiene.
 */
export function genererArkivStempel(dato: Date): string {
  return dato.toLocaleString("nb-NO", {
    timeZone: "Europe/Oslo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Dokumenttyper arkivmalen kan rendre. «oppgave» dekker også HMS avvik/RUH (Task, domain=hms). */
export type ArkivDokumentType = "sjekkliste" | "oppgave";

/** Leser per dokumenttype → normalisert arkiv-HTML. Ny type = ny rad her, ikke ny if-kjede. */
const LESER_PER_TYPE: Record<
  ArkivDokumentType,
  (prisma: PrismaClient, id: string, opts: SammenstillingOpts) => Promise<SammenstillingResultat>
> = {
  sjekkliste: byggSjekklisteArkivHtml,
  oppgave: byggOppgaveArkivHtml,
};

export interface ArkivDokumentRef {
  id: string;
  type: ArkivDokumentType;
}

/** Per-dokument-status i responsen (mangel-kontrakten per dokument, N1). */
export interface ArkivDokumentStatus {
  id: string;
  type: ArkivDokumentType;
  tittel: string;
  manglendeVedlegg: string[];
}

export interface RenderOpts {
  generertTekst: string;
  /** YYYY-MM-DD til samleutskrift-filnavn (N>1). Kalleren eier klokka (Date). */
  datoForFilnavn: string;
  eksport?: boolean;
  /**
   * PDF-1 «Ta med oppgaver»: hver oppgave opprettet fra en sjekkliste legges etter den som egen
   * del (`byggOppgaveArkivHtml`). Utelatt/av → kun henvisningslinja (som vises alltid).
   */
  medOppgaver?: boolean;
  /** PDF-1 «Ta med vedlegg»: PDF-vedlegg legges bakerst (pdf-lib), andre filer med filnavn. */
  medVedlegg?: boolean;
  /** PDF-1: dokumenttilgang per oppgave (arkiv-ruten). */
  oppgaveTilgang?: OppgaveTilgang;
}

/**
 * PDF-1: legg PDF-vedleggene bakerst i den rendrede PDF-en. Fil som ikke kan leses eller
 * tolkes → filnavnet returneres som manglende (samme mangel-kontrakt som bilder).
 */
export async function leggVedleggBakerst(
  pdf: Buffer,
  vedlegg: PdfVedleggRef[],
  hentBytes: (url: string) => Promise<Buffer | null>,
): Promise<{ pdf: Buffer; manglende: string[] }> {
  if (vedlegg.length === 0) return { pdf, manglende: [] };
  const manglende: string[] = [];
  const samlet = await PDFDocument.load(pdf);
  for (const v of vedlegg) {
    const bytes = await hentBytes(v.url);
    if (!bytes) {
      manglende.push(v.filnavn);
      continue;
    }
    try {
      const kilde = await PDFDocument.load(bytes);
      const sider = await samlet.copyPages(kilde, kilde.getPageIndices());
      for (const side of sider) samlet.addPage(side);
    } catch {
      manglende.push(v.filnavn);
    }
  }
  return { pdf: Buffer.from(await samlet.save()), manglende };
}

/** Rens en streng til trygt filnavn-fragment (ingen /, mellomrom, spesialtegn). */
function filnavnTrygg(s: string): string {
  return s.replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^-+|-+$/g, "") || "prosjekt";
}

export interface RenderResultat {
  pdf: Buffer;
  filnavn: string;
  /** true kun når containeren rakk alt OG ingen dokument manglet vedlegg. */
  komplett: boolean;
  /** Containeren rapporterte canvas/pdfjs ikke ferdig innen tidsvakten. */
  renderTimeout: boolean;
  dokumenter: ArkivDokumentStatus[];
}

/** Header/footer-ramme for en samleutskrift (N>1): mal-nivå, ikke ett dokument. */
function byggSamleramme(første: RammeData, antall: number): RammeData {
  return {
    firmaNavn: første.firmaNavn,
    orgnr: undefined,
    dokumenttype: "Samleutskrift",
    dokumentnavn: `${antall} dokumenter`,
    dokumentnummer: "",
    dokumentId: "",
    prosjekt: første.prosjekt,
    logoDataUrl: null,
  };
}

/**
 * Rendr én eller flere dokumenter til ÉN arkiv-PDF. Ruting på dokumenttype via
 * `LESER_PER_TYPE` (sjekkliste + oppgave/HMS). Returnerer PDF-en (base64 legges på
 * i tRPC-laget) + per-dokument mangel-status.
 */
export async function rendrArkivPdf(
  prisma: PrismaClient,
  dokumenter: ArkivDokumentRef[],
  opts: RenderOpts,
): Promise<RenderResultat> {
  const leserOpts: SammenstillingOpts = {
    hentBildeBytes: hentBildeBytesFraDisk,
    generertTekst: opts.generertTekst,
    eksport: opts.eksport,
    medVedlegg: opts.medVedlegg,
    oppgaveTilgang: opts.oppgaveTilgang,
  };
  const bygde = [];
  // Sidene i rekkefølge: hoveddokument, så (med «Ta med oppgaver») dets oppgaver som egne deler.
  const sider: string[] = [];
  const pdfVedlegg: { eier: number; ref: PdfVedleggRef }[] = [];
  for (const dok of dokumenter) {
    const leser = LESER_PER_TYPE[dok.type];
    if (!leser) {
      throw new Error(`Arkivmal kan ikke rendre dokumenttype «${dok.type}».`);
    }
    const r = await leser(prisma, dok.id, leserOpts);
    const manglendeVedlegg = [...r.manglendeVedlegg];
    sider.push(r.side);
    if (opts.medOppgaver) {
      for (const oppgaveId of r.oppgaveIder) {
        const del = await byggOppgaveArkivHtml(prisma, oppgaveId, leserOpts);
        sider.push(del.side);
        // Delens mangler tilhører hoveddokumentet (mangel-kontrakten per bestilt dokument).
        manglendeVedlegg.push(...del.manglendeVedlegg);
        for (const ref of del.pdfVedlegg) pdfVedlegg.push({ eier: bygde.length, ref });
      }
    }
    for (const ref of r.pdfVedlegg) pdfVedlegg.push({ eier: bygde.length, ref });
    bygde.push({ dok, ...r, manglendeVedlegg });
  }

  // Ett BESTILT dokument (oppgavedelene teller ikke) → dokumentets egen ramme og filnavn.
  const enkelt = bygde.length === 1;
  const html = byggArkivSamling(sider);
  // Enkeltdokument: per-dokument-header (dokumentreferanse). Samleutskrift:
  // mal-nivå-header — margin-headeren kan ikke variere per dokument (én template
  // for hele PDF-en), og hvert dokuments egen topptekst bærer identiteten.
  const ramme = enkelt ? bygde[0]!.ramme : byggSamleramme(bygde[0]!.ramme, bygde.length);

  const respons = await fetch(`${PDF_BASE_URL}/pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      html,
      headerTemplate: byggRenderHeader(ramme),
      footerTemplate: byggRenderFooter(ramme, opts.generertTekst),
    }),
  });

  if (!respons.ok) {
    const feil = await respons.text().catch(() => "");
    throw new Error(`pdf-render feil (${respons.status}): ${feil.slice(0, 200)}`);
  }

  const renderTimeout = respons.headers.get("x-render-komplett") === "false";
  let pdf: Buffer = Buffer.from(await respons.arrayBuffer());

  // PDF-1: PDF-vedlegg bakerst (dedup på url på tvers av dokumentene).
  if (opts.medVedlegg && pdfVedlegg.length > 0) {
    const sett = new Set<string>();
    const unike = pdfVedlegg.filter((v) => (sett.has(v.ref.url) ? false : (sett.add(v.ref.url), true)));
    const res = await leggVedleggBakerst(pdf, unike.map((v) => v.ref), hentBildeBytesFraDisk);
    pdf = res.pdf;
    for (const navn of res.manglende) {
      const eier = unike.find((v) => v.ref.filnavn === navn)?.eier ?? 0;
      bygde[eier]!.manglendeVedlegg.push(navn);
    }
  }

  const dokStatus: ArkivDokumentStatus[] = bygde.map((b) => ({
    id: b.dok.id,
    type: b.dok.type,
    tittel: b.tittel,
    manglendeVedlegg: b.manglendeVedlegg,
  }));
  const noeMangler = dokStatus.some((d) => d.manglendeVedlegg.length > 0);

  // N=1: dokumentets eget filnavn (BEF-001.pdf). N>1: samleutskrift-filnavn med
  // prosjektreferanse + dato, så to nedlastinger samme dag ikke kolliderer.
  const filnavn = enkelt
    ? bygde[0]!.filnavn
    : `samleutskrift-${filnavnTrygg(bygde[0]!.prosjektRef)}-${opts.datoForFilnavn}.pdf`;

  return {
    pdf,
    filnavn,
    komplett: !renderTimeout && !noeMangler,
    renderTimeout,
    dokumenter: dokStatus,
  };
}
