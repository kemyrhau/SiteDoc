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
  <!-- Oversiktsbilde med markør — inline styles for expo-print kompatibilitet -->
  <div style="position:relative;border:1px solid #e5e7eb;border-radius:4px;overflow:hidden;height:260px;">
    <img src="${esc(tegningBildeUrl)}" alt="${esc(tegningNavn ?? "Tegning")}" style="width:100%;height:100%;object-fit:contain;" />
    <div style="position:absolute;left:${x}%;top:${y}%;width:12px;height:12px;border-radius:50%;background:#ef4444;border:2px solid white;transform:translate(-50%,-50%);z-index:2;"></div>
    <div style="position:absolute;border:2px solid #f87171;left:${rammeX}%;top:${rammeY}%;width:${rammeStørrelse}%;height:${rammeStørrelse}%;z-index:1;"></div>
    <div style="position:absolute;bottom:4px;left:4px;background:rgba(255,255,255,0.8);padding:1px 6px;border-radius:3px;font-size:9px;font-weight:500;color:#6b7280;">Oversikt</div>
  </div>

  <!-- Detalj-utsnitt -->
  <div style="position:relative;border:1px solid #e5e7eb;border-radius:4px;overflow:hidden;height:260px;">
    <img src="${esc(tegningBildeUrl)}" alt="Detalj" style="width:100%;height:100%;object-fit:cover;transform-origin:${x}% ${y}%;transform:scale(${DETALJ_ZOOM});" />
    <div style="position:absolute;left:50%;top:50%;width:12px;height:12px;border-radius:50%;background:#ef4444;border:2px solid white;transform:translate(-50%,-50%);z-index:2;"></div>
    <div style="position:absolute;bottom:4px;left:4px;background:rgba(255,255,255,0.8);padding:1px 6px;border-radius:3px;font-size:9px;font-weight:500;color:#6b7280;">Detalj</div>
  </div>
</div>`;
}
