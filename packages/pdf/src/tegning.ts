/**
 * Tegningsposisjon i PDF — oversiktsbilde med markør + zoomet utsnitt.
 * Brukes av både web og mobil.
 */

import { esc } from "./hjelpere";

const DETALJ_ZOOM = 4;

export interface TegningPosisjonData {
  /** Tegnings-URL (allerede full URL eller data:URI) */
  tegningBildeUrl: string;
  /** Tegningsnavn for visning */
  tegningNavn?: string;
  /** Posisjon i prosent (0–100) */
  positionX: number;
  positionY: number;
}

/**
 * Genererer HTML med oversikt + detalj-utsnitt for tegningsposisjon.
 * Forutsetter at tegningsbildet allerede er tilgjengelig som URL.
 */
export function byggTegningPosisjon(data: TegningPosisjonData): string {
  const { tegningBildeUrl, tegningNavn, positionX: x, positionY: y } = data;

  // Beregn detalj-ramme posisjon
  const rammeStørrelse = 100 / DETALJ_ZOOM;
  const rammeX = Math.max(0, Math.min(100 - rammeStørrelse, x - rammeStørrelse / 2));
  const rammeY = Math.max(0, Math.min(100 - rammeStørrelse, y - rammeStørrelse / 2));

  return `
${tegningNavn ? `<div style="font-size:10px;font-weight:500;color:#374151;margin-bottom:6px;">${esc(tegningNavn)}</div>` : ""}
<div class="tegning-container">
  <!-- Oversiktsbilde med markør -->
  <div class="tegning-celle">
    <img src="${esc(tegningBildeUrl)}" alt="${esc(tegningNavn ?? "Tegning")}" />
    <div class="tegning-markør" style="left:${x}%;top:${y}%;"></div>
    <div style="position:absolute;border:2px solid #f87171;left:${rammeX}%;top:${rammeY}%;width:${rammeStørrelse}%;height:${rammeStørrelse}%;"></div>
    <div class="tegning-etikett">Oversikt</div>
  </div>

  <!-- Detalj-utsnitt -->
  <div class="tegning-celle" style="overflow:hidden;">
    <img src="${esc(tegningBildeUrl)}" alt="Detalj" style="width:100%;height:100%;object-fit:cover;transform-origin:${x}% ${y}%;transform:scale(${DETALJ_ZOOM});" />
    <div class="tegning-markør" style="left:50%;top:50%;"></div>
    <div class="tegning-etikett">Detalj</div>
  </div>
</div>`;
}
