/**
 * Screenshot-basert tegningsvisning i PDF.
 * Tar et ferdig base64-bilde (screenshot av tegning med prikk)
 * og embedder det direkte — ingen koordinatberegning.
 * Detalj-utsnitt lages ved å zoome inn på prikk-posisjonen i samme bilde.
 */

import { esc } from "./hjelpere";

const DETALJ_ZOOM = 4;

export interface TegningScreenshotData {
  /** Base64-bilde (data:image/png;base64,...) av tegning med posisjonsprikk */
  screenshotBase64: string;
  /** Tegningsnavn for visning */
  tegningNavn?: string;
  /** Prikkens posisjon i prosent (0–100) — brukes for detalj-utsnitt */
  positionX?: number;
  positionY?: number;
}

/**
 * Genererer HTML med oversikt + detalj fra samme screenshot-bilde.
 * Oversikt: hele bildet med prikk (pixel-perfekt).
 * Detalj: CSS transform scale+translate for å zoome inn rundt prikken.
 */
export function genererTegningMedScreenshot(data: TegningScreenshotData): string {
  const { screenshotBase64, tegningNavn, positionX, positionY } = data;
  const harPosisjon = positionX != null && positionY != null;

  const imgTag = `<img src="${screenshotBase64}" alt="${esc(tegningNavn ?? "Tegning")}"`;

  // Uten posisjon — kun oversiktsbilde
  if (!harPosisjon) {
    return `
${tegningNavn ? `<div style="font-size:10px;font-weight:500;color:#374151;margin-bottom:6px;">${esc(tegningNavn)}</div>` : ""}
<div style="border:1px solid #e5e7eb;border-radius:4px;overflow:hidden;width:100%;margin-bottom:10px;">
  ${imgTag} style="display:block;width:100%;height:auto;" />
</div>`;
  }

  // Med posisjon — oversikt + detalj side om side
  return `
${tegningNavn ? `<div style="font-size:10px;font-weight:500;color:#374151;margin-bottom:6px;">${esc(tegningNavn)}</div>` : ""}
<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;">
  <!-- Oversikt — hele screenshot-bildet -->
  <div style="border:1px solid #e5e7eb;border-radius:4px;overflow:hidden;">
    ${imgTag} style="display:block;width:100%;height:auto;" />
    <div style="font-size:9px;color:#6b7280;padding:2px 4px;">Oversikt</div>
  </div>

  <!-- Detalj — zoom inn på prikken fra samme bilde -->
  <div style="border:1px solid #e5e7eb;border-radius:4px;overflow:hidden;height:260px;">
    ${imgTag} style="width:100%;height:100%;object-fit:cover;transform-origin:${positionX}% ${positionY}%;transform:scale(${DETALJ_ZOOM});" />
    <div style="position:relative;margin-top:-20px;font-size:9px;color:#6b7280;padding:2px 4px;background:rgba(255,255,255,0.8);display:inline-block;border-radius:0 3px 0 0;">Detalj</div>
  </div>
</div>`;
}
