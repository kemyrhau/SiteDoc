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
<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;">
  <!-- Oversiktsbilde med markør — SVG for expo-print kompatibilitet -->
  <div style="border:1px solid #e5e7eb;border-radius:4px;overflow:hidden;width:100%;">
    <svg width="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style="display:block;">
      <image href="${esc(tegningBildeUrl)}" x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid meet"/>
      <circle cx="${x}" cy="${y}" r="2" fill="#ef4444" stroke="white" stroke-width="0.5"/>
      <rect x="${rammeX}" y="${rammeY}" width="${rammeStørrelse}" height="${rammeStørrelse}" fill="none" stroke="#f87171" stroke-width="0.5"/>
    </svg>
    <div style="font-size:9px;color:#6b7280;padding:2px 4px;">Oversikt</div>
  </div>

  <!-- Detalj-utsnitt -->
  <div style="position:relative;border:1px solid #e5e7eb;border-radius:4px;overflow:hidden;height:260px;">
    <img src="${esc(tegningBildeUrl)}" alt="Detalj" style="width:100%;height:100%;object-fit:cover;transform-origin:${x}% ${y}%;transform:scale(${DETALJ_ZOOM});" />
    <div style="position:absolute;left:50%;top:50%;width:12px;height:12px;border-radius:50%;background:#ef4444;border:2px solid white;transform:translate(-50%,-50%);z-index:2;"></div>
    <div style="position:absolute;bottom:4px;left:4px;background:rgba(255,255,255,0.8);padding:1px 6px;border-radius:3px;font-size:9px;font-weight:500;color:#6b7280;">Detalj</div>
  </div>
</div>`;
}
