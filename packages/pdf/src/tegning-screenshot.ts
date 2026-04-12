/**
 * Screenshot-basert tegningsvisning i PDF.
 * Tar et ferdig base64-bilde (screenshot av tegning med prikk)
 * og embedder det direkte — ingen koordinatberegning.
 */

import { esc } from "./hjelpere";

export interface TegningScreenshotData {
  /** Base64-bilde (data:image/png;base64,...) av tegning med posisjonsprikk */
  screenshotBase64: string;
  /** Tegningsnavn for visning */
  tegningNavn?: string;
}

/**
 * Genererer HTML med screenshot av tegning med prikk.
 * Pixel-perfekt fordi bildet er nøyaktig det som vises på skjermen.
 */
export function genererTegningMedScreenshot(data: TegningScreenshotData): string {
  const { screenshotBase64, tegningNavn } = data;

  return `
${tegningNavn ? `<div style="font-size:10px;font-weight:500;color:#374151;margin-bottom:6px;">${esc(tegningNavn)}</div>` : ""}
<div style="border:1px solid #e5e7eb;border-radius:4px;overflow:hidden;width:100%;margin-bottom:10px;">
  <img src="${screenshotBase64}" alt="${esc(tegningNavn ?? "Tegning")}" style="display:block;width:100%;height:auto;" />
</div>`;
}
