/**
 * Arkivmal 4c — per-side header/footer for Playwright (`page.pdf`-templates).
 *
 * Chromium rendrer header/footer i side-margin som EGNE mini-dokumenter: de får
 * IKKE dokumentets CSS, og `font-size` er default 0 (usynlig). Derfor bygges de
 * her med inline-stiler, ikke via arkivmalens klasse-baserte byggeklosser.
 * Sidetall injiseres av Chromium i `.pageNumber`/`.totalPages`-spennene.
 *
 * - HEADER (side 2+ i praksis, men Chromium rendrer på alle sider): slank
 *   fortsettelses-linje — firma · dokument-referanse. Speiler
 *   `byggFortsettelsesHeader`, men inline-stilt for margin-konteksten.
 * - FOOTER (HVER side, § 4-sporbarhet): «Generert fra SiteDoc … · dokument-id …»
 *   venstre, «Side X av Y» høyre.
 *
 * Padding 0 16mm speiler side-margin i `server.mjs` slik at header/footer flukter
 * med brødteksten. Verifiseres på ekte dokument (4c watch-item).
 */
import { esc } from "@sitedoc/pdf";
import type { RammeData } from "./sammenstilling";

const F = {
  tekst: "#111827",
  graa: "#6b7280",
  navy: "#26327e",
} as const;

const KANT = "0 16mm";

/** Slank fortsettelses-header. Inline-stilt (margin-konteksten arver ingen CSS). */
export function byggRenderHeader(ramme: RammeData): string {
  const orgnr = ramme.orgnr
    ? ` <span style="color:${F.graa};font-weight:400">· Org.nr ${esc(ramme.orgnr)}</span>`
    : "";
  const logo = ramme.logoDataUrl
    ? `<img src="${esc(ramme.logoDataUrl)}" alt="" style="height:9px;margin-right:6px;vertical-align:middle">`
    : "";
  const dokRef = [
    `${esc(ramme.dokumenttype)} — ${esc(ramme.dokumentnavn)}`,
    `<strong style="color:${F.tekst}">${esc(ramme.dokumentnummer)}</strong>`,
    ramme.prosjekt ? esc(ramme.prosjekt) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return `
<div style="width:100%;box-sizing:border-box;padding:${KANT};font-family:Arial,Helvetica,sans-serif;font-size:7px;color:${F.graa};display:flex;justify-content:space-between;align-items:center">
  <span style="color:${F.navy};font-weight:600">${logo}${esc(ramme.firmaNavn)}${orgnr}</span>
  <span>${dokRef}</span>
</div>`.trim();
}

/**
 * Bunntekst på HVER side. Generert-stempel + dokument-id (sporbarhetsminimum,
 * § 4) venstre; «Side X av Y» høyre med Chromium-injiserte sidetall.
 */
export function byggRenderFooter(ramme: RammeData, generertTekst: string): string {
  return `
<div style="width:100%;box-sizing:border-box;padding:${KANT};font-family:Arial,Helvetica,sans-serif;font-size:7px;color:${F.graa};display:flex;justify-content:space-between;align-items:center">
  <span>Generert fra SiteDoc ${esc(generertTekst)} · dokument-id ${esc(ramme.dokumentId)}</span>
  <span>Side <span class="pageNumber"></span> av <span class="totalPages"></span></span>
</div>`.trim();
}
