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
import { byggSjekklisteArkivHtml, type RammeData } from "./sammenstilling";
import { hentBildeBytesFraDisk } from "./disk-bilde";
import { byggRenderHeader, byggRenderFooter } from "./render-templates";
import type { PrismaClient } from "@sitedoc/db";

// PDF_URL er base-URL til containeren (compose: http://pdf-render:3304); /pdf
// føyes til her, samme mønster som oversettelse-service kaller /translate.
const PDF_BASE_URL = process.env.PDF_URL || "http://pdf-render:3304";

/** Dokumenttyper arkivmalen kan rendre. «oppgave» følger når task-leseren er bygget. */
export type ArkivDokumentType = "sjekkliste" | "oppgave";

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
 * Rendr én eller flere dokumenter til ÉN arkiv-PDF. Ruting på dokumenttype;
 * bare «sjekkliste» er bygget nå (oppgave-leseren følger). Returnerer PDF-en
 * (base64 legges på i tRPC-laget) + per-dokument mangel-status.
 */
export async function rendrArkivPdf(
  prisma: PrismaClient,
  dokumenter: ArkivDokumentRef[],
  opts: RenderOpts,
): Promise<RenderResultat> {
  const bygde = [];
  for (const dok of dokumenter) {
    if (dok.type !== "sjekkliste") {
      throw new Error(`Arkivmal kan ikke rendre dokumenttype «${dok.type}» ennå (kun sjekkliste).`);
    }
    const r = await byggSjekklisteArkivHtml(prisma, dok.id, {
      hentBildeBytes: hentBildeBytesFraDisk,
      generertTekst: opts.generertTekst,
      eksport: opts.eksport,
    });
    bygde.push({ dok, ...r });
  }

  const enkelt = bygde.length === 1;
  const html = byggArkivSamling(bygde.map((b) => b.side));
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
  const pdf = Buffer.from(await respons.arrayBuffer());

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
