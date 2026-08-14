/**
 * Arkivmal 4c — render-orkestrator (api-siden).
 *
 * Kjeder: byggSjekklisteArkivHtml (HTML m/ inlinede bilder) → per-side
 * header/footer-templates → POST til pdf-render-containeren (PDF_URL) → PDF-bytes
 * + fullstendighets-signal. Containeren er en ren konverter (ingen DB, ingen
 * secret); denne fila eier data-hentingen og leveringen.
 *
 * Fullstendighet slås sammen fra to kilder:
 *   1. `manglendeVedlegg` — bilder som ikke lot seg lese fra disk (mangel-
 *      merknaden i dokumentet dekker disse).
 *   2. `x-render-komplett: false` fra containeren — canvas/pdfjs ble ikke ferdig
 *      innen tidsvakten (EKSTRA ufullstendig-signal; kan bety for tynn timeout).
 */
import { byggSjekklisteArkivHtml } from "./sammenstilling";
import { hentBildeBytesFraDisk } from "./disk-bilde";
import { byggRenderHeader, byggRenderFooter } from "./render-templates";
import type { PrismaClient } from "@sitedoc/db";

// PDF_URL er base-URL til containeren (compose: http://pdf-render:3304); /pdf
// føyes til her, samme mønster som oversettelse-service kaller /translate.
const PDF_BASE_URL = process.env.PDF_URL || "http://pdf-render:3304";

export interface RenderOpts {
  generertTekst: string;
  taMedEndringslogg?: boolean;
  eksport?: boolean;
}

export interface RenderResultat {
  pdf: Buffer;
  /** true kun når containeren rakk alt OG ingen vedlegg manglet. */
  komplett: boolean;
  /** Containeren rapporterte canvas/pdfjs ikke ferdig innen tidsvakten. */
  renderTimeout: boolean;
  manglendeVedlegg: string[];
}

export async function rendrerSjekklisteArkivPdf(
  prisma: PrismaClient,
  sjekklisteId: string,
  opts: RenderOpts,
): Promise<RenderResultat> {
  const { html, manglendeVedlegg, ramme } = await byggSjekklisteArkivHtml(prisma, sjekklisteId, {
    hentBildeBytes: hentBildeBytesFraDisk,
    generertTekst: opts.generertTekst,
    taMedEndringslogg: opts.taMedEndringslogg,
    eksport: opts.eksport,
  });

  const headerTemplate = byggRenderHeader(ramme);
  const footerTemplate = byggRenderFooter(ramme, opts.generertTekst);

  const respons = await fetch(`${PDF_BASE_URL}/pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html, headerTemplate, footerTemplate }),
  });

  if (!respons.ok) {
    const feil = await respons.text().catch(() => "");
    throw new Error(`pdf-render feil (${respons.status}): ${feil.slice(0, 200)}`);
  }

  const renderTimeout = respons.headers.get("x-render-komplett") === "false";
  const pdf = Buffer.from(await respons.arrayBuffer());

  return {
    pdf,
    komplett: !renderTimeout && manglendeVedlegg.length === 0,
    renderTimeout,
    manglendeVedlegg,
  };
}
