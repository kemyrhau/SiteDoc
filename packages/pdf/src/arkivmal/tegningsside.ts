/**
 * Arkivmal — D2b helside tegningsprint (fabel 2026-08-21, revidert 2026-08-21).
 *
 * Per tegning som har markeringer i dokumentet: ÉN helside (i rapportkroppen,
 * `break-before:page`) med hele tegningen i størst mulig format (roteres til
 * liggende når bredere enn høy) og ALLE markører nummerert.
 *
 * REVISJON (Kenneth-vedtak 2026-08-21): detaljutsnittet er flyttet INN i
 * repeater-tabellens «Posisjon i tegning»-celle (rapportkroppen), så markør→punkt-
 * tabellen på helsiden er FJERNET (den ble duplikat). Markørnummeret = radnummeret
 * i repeater-tabellen, som allerede står der. Helsiden = tegning + nummererte
 * markører, ingenting mer.
 *
 * `felt.ts` frosset; ren HTML-streng, ingen avhengigheter.
 */

import { esc } from "../hjelpere";

/** Én markør på helsiden — nummer = radnummer i repeater-tabellen. */
export interface TegningssideMarkor {
  nr: number;
  /** Posisjon i prosent (0–100). */
  x: number;
  y: number;
}

/** Én tegnings helside-data. */
export interface TegningssideData {
  tegningNavn: string;
  /** Inlinet full tegning (data-URI). */
  bildeDataUrl: string;
  imageWidth?: number | null;
  imageHeight?: number | null;
  markorer: TegningssideMarkor[];
}

/**
 * Nummerert markør-overlay på full tegning. SVG med korrekt aspect ratio;
 * hver markør = rød sirkel + hvitt tall (= radnummer).
 */
function byggFullTegning(data: TegningssideData): string {
  const { bildeDataUrl, imageWidth, imageHeight, markorer } = data;
  const vbW = imageWidth && imageHeight ? (imageWidth / imageHeight) * 100 : 100;
  const vbH = 100;
  const liggende = !!(imageWidth && imageHeight) && imageWidth > imageHeight;
  const prikkR = 2.6 * vbW / 100;
  const strek = 0.4 * vbW / 100;
  const tallStr = 3.0 * vbW / 100;

  const markorSvg = markorer
    .map((m) => {
      const cx = (m.x * vbW) / 100;
      const cy = m.y;
      return (
        `<circle cx="${cx}" cy="${cy}" r="${prikkR}" fill="#ef4444" stroke="white" stroke-width="${strek}"/>` +
        `<text x="${cx}" y="${cy}" fill="white" font-size="${tallStr}" font-weight="700" text-anchor="middle" dominant-baseline="central">${m.nr}</text>`
      );
    })
    .join("");

  const svg =
    `<svg width="100%" viewBox="0 0 ${vbW} ${vbH}" preserveAspectRatio="xMidYMid meet" style="display:block;">` +
    `<image href="${esc(bildeDataUrl)}" x="0" y="0" width="${vbW}" height="${vbH}" preserveAspectRatio="none"/>` +
    markorSvg +
    `</svg>`;

  // Bredere enn høy → roter 90° for å bruke stående A4 best.
  return `<div class="ark-tegning-full${liggende ? " ark-tegning-liggende" : ""}">${svg}</div>`;
}

/** Én tegnings helside (i rapportkroppen — `break-before:page` via CSS). */
export function byggTegningsside(data: TegningssideData): string {
  if (data.markorer.length === 0) return ""; // ingen markører → ingen side
  return (
    `<div class="ark-tegningsside">` +
    `<div class="ark-seksjon">${esc(data.tegningNavn)}</div>` +
    byggFullTegning(data) +
    `</div>`
  );
}

/** Alle tegningssider (én helside per tegning m/ markører). Tom liste → "". */
export function byggTegningssider(sider: TegningssideData[]): string {
  return sider.map(byggTegningsside).filter(Boolean).join("\n");
}
