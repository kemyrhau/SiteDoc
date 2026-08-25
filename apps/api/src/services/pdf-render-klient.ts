/**
 * Klient mot den interne pdf-render-containeren (Playwright `page.pdf`).
 *
 * Samme container og endepunkt som arkiv.rendr bruker (`services/arkiv/render.ts`):
 * en ren HTML→PDF-konverter (ingen DB, ingen secret). Serveren eier HTML-en —
 * ALDRI send klient-generert HTML hit (Chromium ville hentet eksterne URL-er →
 * SSRF). Denne hjelperen tar ferdig server-bygget HTML + header/footer-templates
 * og returnerer PDF-bytene.
 */

const PDF_BASE_URL = process.env.PDF_URL || "http://pdf-render:3304";

export interface PdfRenderResultat {
  pdf: Buffer;
  /** Containeren rakk ikke canvas/pdfjs innen tidsvakten (gjelder hele PDF-en). */
  renderTimeout: boolean;
}

export async function renderPdfViaContainer(
  html: string,
  headerTemplate: string,
  footerTemplate: string,
): Promise<PdfRenderResultat> {
  const respons = await fetch(`${PDF_BASE_URL}/pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html, headerTemplate, footerTemplate }),
  });
  if (!respons.ok) {
    const feil = await respons.text().catch(() => "");
    throw new Error(`pdf-render feil (${respons.status}): ${feil.slice(0, 200)}`);
  }
  return {
    pdf: Buffer.from(await respons.arrayBuffer()),
    renderTimeout: respons.headers.get("x-render-komplett") === "false",
  };
}
