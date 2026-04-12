/**
 * Screenshot-basert tegningsvisning i PDF.
 * Oversikt: ferdig base64-screenshot av tegning med prikk.
 * Detalj: pre-croppet base64-bilde fra server (sharp crop).
 * Ingen CSS-transform, ingen koordinatberegning i PDF.
 */

import { esc } from "./hjelpere";

export interface TegningScreenshotData {
  /** Base64-bilde (data:image/png;base64,...) av tegning med posisjonsprikk */
  screenshotBase64: string;
  /** Pre-croppet detalj-bilde (data:image/png;base64,...) */
  detaljBase64?: string | null;
  /** Tegningsnavn for visning */
  tegningNavn?: string;
}

/**
 * Genererer HTML med oversikt + detalj fra ferdig-renderte bilder.
 * Begge er enkle <img>-tagger — ingen CSS-transform.
 */
export function genererTegningMedScreenshot(data: TegningScreenshotData): string {
  const { screenshotBase64, detaljBase64, tegningNavn } = data;

  // Uten detalj — kun oversiktsbilde
  if (!detaljBase64) {
    return `
${tegningNavn ? `<div style="font-size:10px;font-weight:500;color:#374151;margin-bottom:6px;">${esc(tegningNavn)}</div>` : ""}
<div style="border:1px solid #e5e7eb;border-radius:4px;overflow:hidden;width:100%;margin-bottom:10px;">
  <img src="${screenshotBase64}" alt="${esc(tegningNavn ?? "Tegning")}" style="display:block;width:100%;height:auto;" />
</div>`;
  }

  // Med detalj — oversikt + detalj side om side
  return `
${tegningNavn ? `<div style="font-size:10px;font-weight:500;color:#374151;margin-bottom:6px;">${esc(tegningNavn)}</div>` : ""}
<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;">
  <!-- Oversikt -->
  <div style="border:1px solid #e5e7eb;border-radius:4px;overflow:hidden;">
    <img src="${screenshotBase64}" alt="${esc(tegningNavn ?? "Tegning")}" style="display:block;width:100%;height:auto;" />
    <div style="font-size:9px;color:#6b7280;padding:2px 4px;">Oversikt</div>
  </div>
  <!-- Detalj — pre-croppet av server -->
  <div style="border:1px solid #e5e7eb;border-radius:4px;overflow:hidden;">
    <img src="${detaljBase64}" alt="Detalj" style="display:block;width:100%;height:auto;" />
    <div style="font-size:9px;color:#6b7280;padding:2px 4px;">Detalj</div>
  </div>
</div>`;
}
