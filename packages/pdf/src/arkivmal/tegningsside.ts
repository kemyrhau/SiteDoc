/**
 * Arkivmal — D2b helside tegningsprint (fabel-ratifisert 2026-08-21).
 *
 * Per tegning som har markeringer i dokumentet: ÉN helside med hele tegningen i
 * størst mulig format (roteres til liggende når bredere enn høy), ALLE markører
 * nummerert (flat nummerering per tegning = punktnr), + markør→punkt-tabell under:
 * markør# · punkttekst · detaljutsnitt (· resultat kun når malen har status-kolonne).
 *
 * Gates (fabel): (1) bilde-bevisst paginering — rad med utsnitt splittes aldri
 * over sidegrense (`break-inside:avoid` per rad; tabellen flyter til nye sider).
 * (2) Fast utsnitts-spek — utsnittene er pre-croppet server-side (4×-zoom, 4:3,
 * klemt til tegningskant) og rendres av `byggDetaljUtsnitt` med `zoom:1` (croppen
 * ER zoomen). (3) Moderat DPI — cropene er nedskalert server-side, ikke full
 * tegning gjentatt N ganger. (4) Gjenbruk — `byggDetaljUtsnitt` (parametrisk).
 *
 * `felt.ts` frosset; ren HTML-streng, ingen avhengigheter.
 */

import { esc } from "../hjelpere";
import { byggDetaljUtsnitt } from "../tegning";
import { ARKIV_FARGER } from "./arkiv-css";

/** Én markør på helsiden. */
export interface TegningssideMarkor {
  /** Flat nummer per tegning (= punktnr i rapporten). */
  nr: number;
  /** Posisjon i prosent (0–100). */
  x: number;
  y: number;
  /** Punkttekst (repeater-radens tekstfelt) — null → «—». */
  punkttekst: string | null;
  /** Valgfri resultat-kolonne (kun når malen har status-felt). */
  resultat: string | null;
  /** Pre-croppet, moderat-DPI detaljutsnitt (data-URI) — null → stiplet tom celle. */
  utsnittDataUrl: string | null;
}

/** Én tegnings helside-data. */
export interface TegningssideData {
  tegningNavn: string;
  /** Inlinet full tegning (data-URI). */
  bildeDataUrl: string;
  imageWidth?: number | null;
  imageHeight?: number | null;
  markorer: TegningssideMarkor[];
  /** Vis resultat-kolonne (malen har status-felt). */
  visResultat: boolean;
}

/** Detaljutsnittets fysiske høyde i tabellraden (~3 cm ≈ 96px, samme som arbeidsliste-utsnitt). */
const UTSNITT_HOYDE_PX = 96;

/**
 * Nummerert markør-overlay på full tegning. SVG med korrekt aspect ratio;
 * hver markør = rød sirkel + hvitt tall. Speiler `byggTegningPosisjon`-stilen.
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

  // Bredere enn høy → roter 90° for å bruke stående A4 best (Gate: «roteres til
  // liggende»). Rotasjonen skjer på et wrap-element; SVG-en beholder sin ratio.
  const svg =
    `<svg width="100%" viewBox="0 0 ${vbW} ${vbH}" preserveAspectRatio="xMidYMid meet" style="display:block;">` +
    `<image href="${esc(bildeDataUrl)}" x="0" y="0" width="${vbW}" height="${vbH}" preserveAspectRatio="none"/>` +
    markorSvg +
    `</svg>`;

  if (liggende) {
    // Roter 90°: bredden blir sidehøyde. Wrap i fast-høyde-boks som roteres.
    return `<div class="ark-tegning-full ark-tegning-liggende">${svg}</div>`;
  }
  return `<div class="ark-tegning-full">${svg}</div>`;
}

/** Markør→punkt-tabell. Hver rad `break-inside:avoid` (Gate 1). */
function byggMarkorTabell(data: TegningssideData): string {
  const kolonner =
    `<th class="ark-rad-nr">#</th><th>Punkt</th>` +
    (data.visResultat ? `<th>Resultat</th>` : "") +
    `<th>Utsnitt</th>`;

  const rader = data.markorer
    .map((m) => {
      const punkt = m.punkttekst ? esc(m.punkttekst) : `<span class="tom">—</span>`;
      const resultat = data.visResultat
        ? `<td>${m.resultat ? esc(m.resultat) : `<span class="tom">—</span>`}</td>`
        : "";
      const utsnitt = m.utsnittDataUrl
        ? byggDetaljUtsnitt({ url: m.utsnittDataUrl, x: 50, y: 50, hoydePx: UTSNITT_HOYDE_PX, zoom: 1 })
        : `<div class="ark-utsnitt-mangler"></div>`;
      return (
        `<tr class="ark-markor-rad">` +
        `<td class="ark-rad-nr">${m.nr}</td>` +
        `<td>${punkt}</td>` +
        resultat +
        `<td class="ark-utsnitt-celle">${utsnitt}</td>` +
        `</tr>`
      );
    })
    .join("");

  return (
    `<table class="ark-repeater ark-markor-tabell">` +
    `<thead><tr><th class="ark-rad-nr" style="color:${ARKIV_FARGER.navy}">#</th>` +
    `<th>Punkt</th>${data.visResultat ? `<th>Resultat</th>` : ""}<th>Utsnitt</th></tr></thead>` +
    `<tbody>${rader}</tbody>` +
    `</table>`
  );
}

/** Én tegnings helside som `.ark-side` (egen PDF-side). */
export function byggTegningsside(data: TegningssideData): string {
  if (data.markorer.length === 0) return ""; // ingen markører → ingen side
  const tittel = `<div class="ark-seksjon">${esc(data.tegningNavn)}</div>`;
  return (
    `<div class="ark-side ark-tegningsside">` +
    tittel +
    byggFullTegning(data) +
    byggMarkorTabell(data) +
    `</div>`
  );
}

/** Alle tegningssider (én `.ark-side` per tegning m/ markører). Tom liste → "". */
export function byggTegningssider(sider: TegningssideData[]): string {
  return sider.map(byggTegningsside).filter(Boolean).join("\n");
}
