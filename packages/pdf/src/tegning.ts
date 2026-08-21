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
  /** Originalbildets dimensjoner for korrekt SVG viewBox */
  imageWidth?: number | null;
  imageHeight?: number | null;
}

export interface DetaljUtsnittData {
  /** Tegnings-URL (full URL eller data:URI) */
  url: string;
  /** Markørens posisjon i prosent (0–100) — brukes som `transform-origin`. */
  x: number;
  y: number;
  /** Utsnittets fysiske høyde i px (parameter — Gate 4: målstørrelse styres av kalleren). */
  hoydePx: number;
  /** Zoom-faktor (D2-blokk: 4×). */
  zoom: number;
}

/**
 * Detalj-utsnitt (zoomet crop rundt markøren) som egen byggekloss. Trukket ut av
 * `byggTegningPosisjon` (ren ekstraksjon 2026-08-21) slik at D2b-radutsnittet kan
 * gjenbruke SAMME crop-maskineri med egen `hoydePx`/`zoom` — Gate 4: funksjonen
 * tar målstørrelse som PARAMETER, ellers er det ny kodeflate, ikke gjenbruk.
 * `byggTegningPosisjon` kaller den med `hoydePx=260, zoom=4` → bit-for-bit uendret
 * gammel PDF-vei (verifisert i tegning.test.ts).
 */
export function byggDetaljUtsnitt({ url, x, y, hoydePx, zoom }: DetaljUtsnittData): string {
  return `<div style="position:relative;border:1px solid #e5e7eb;border-radius:4px;overflow:hidden;height:${hoydePx}px;">
    <img src="${esc(url)}" alt="Detalj" style="width:100%;height:100%;object-fit:cover;transform-origin:${x}% ${y}%;transform:scale(${zoom});" />
    <div style="position:absolute;left:50%;top:50%;width:12px;height:12px;border-radius:50%;background:#ef4444;border:2px solid white;transform:translate(-50%,-50%);z-index:2;"></div>
    <div style="position:absolute;bottom:4px;left:4px;background:rgba(255,255,255,0.8);padding:1px 6px;border-radius:3px;font-size:9px;font-weight:500;color:#6b7280;">Detalj</div>
  </div>`;
}

/**
 * Genererer HTML med oversikt + detalj-utsnitt for tegningsposisjon.
 * Forutsetter at tegningsbildet allerede er tilgjengelig som URL.
 */
export function byggTegningPosisjon(data: TegningPosisjonData): string {
  const { tegningBildeUrl, tegningNavn, positionX: x, positionY: y, imageWidth, imageHeight } = data;

  // ViewBox basert på bildets faktiske aspect ratio
  // x/y er prosent (0-100) av bildet → skaleres til viewBox-koordinater
  const vbW = (imageWidth && imageHeight) ? (imageWidth / imageHeight) * 100 : 100;
  const vbH = 100;

  // Koordinater i viewBox-rom
  const cx = x * vbW / 100;
  const cy = y;

  // Detalj-ramme
  const rammeStørrelse = 100 / DETALJ_ZOOM;
  const rammeW = rammeStørrelse * vbW / 100;
  const rammeH = rammeStørrelse;
  const rammeX = Math.max(0, Math.min(vbW - rammeW, cx - rammeW / 2));
  const rammeY = Math.max(0, Math.min(vbH - rammeH, cy - rammeH / 2));

  // Prikkstørrelse relativ til viewBox
  const prikkR = 1.5 * vbW / 100;
  const strek = 0.4 * vbW / 100;
  const rammeStrek = 0.3 * vbW / 100;

  return `
${tegningNavn ? `<div style="font-size:10px;font-weight:500;color:#374151;margin-bottom:6px;">${esc(tegningNavn)}</div>` : ""}
<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;">
  <!-- Oversiktsbilde med markør — SVG med korrekt aspect ratio -->
  <div style="border:1px solid #e5e7eb;border-radius:4px;overflow:hidden;width:100%;">
    <svg width="100%" viewBox="0 0 ${vbW} ${vbH}" preserveAspectRatio="xMidYMid meet" style="display:block;">
      <image href="${esc(tegningBildeUrl)}" x="0" y="0" width="${vbW}" height="${vbH}" preserveAspectRatio="none"/>
      <circle cx="${cx}" cy="${cy}" r="${prikkR}" fill="#ef4444" stroke="white" stroke-width="${strek}"/>
      <rect x="${rammeX}" y="${rammeY}" width="${rammeW}" height="${rammeH}" fill="none" stroke="#f87171" stroke-width="${rammeStrek}"/>
    </svg>
    <div style="font-size:9px;color:#6b7280;padding:2px 4px;">Oversikt</div>
  </div>

  <!-- Detalj-utsnitt -->
  ${byggDetaljUtsnitt({ url: tegningBildeUrl, x, y, hoydePx: 260, zoom: DETALJ_ZOOM })}
</div>`;
}
