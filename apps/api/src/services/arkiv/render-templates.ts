/**
 * Arkivmal 4c — per-side header/footer for Playwright (`page.pdf`-templates).
 *
 * Chromium rendrer header/footer i side-margin som EGNE mini-dokumenter: de får
 * IKKE dokumentets CSS, og `font-size` er default 0 (usynlig). Derfor bygges de
 * her med inline-stiler, ikke via arkivmalens klasse-baserte byggeklosser.
 * Sidetall injiseres av Chromium i `.pageNumber`/`.totalPages`-spennene.
 *
 * - HEADER (alle sider — Chromium kan ikke slå den av per side): slank linje med
 *   KUN dokumentreferanse. Firma/prosjekt utelates bevisst — de står i brødtekst-
 *   toppteksten på side 1, og å gjenta dem i margin-headeren dupliserte side 1.
 * - FOOTER (HVER side, § 4-sporbarhet): «Generert fra SiteDoc …» venstre,
 *   «Side X av Y» høyre. Dokument-id utgår (vedtak 2026-08-16, funn 3): intern
 *   DB-nøkkel, ubrukelig på papir — brukerens referanse er Dokumentnr. i toppen.
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

/**
 * Slank margin-header. Chromium rendrer den i topp-margin på ALLE sider (kan
 * ikke slås av per side — `@page :first` overstyres av `page.pdf({ margin })`).
 * Derfor bærer den KUN dokumentreferanse — komplementært til brødtekst-
 * toppteksten, som på side 1 alt har firma/org.nr/prosjekt/status. Firma- og
 * prosjektnavn utelates her (ville duplisert side 1); sporbarhets-sidetall
 * ligger i footeren. Inline-stilt (margin-konteksten arver ingen CSS).
 */
export function byggRenderHeader(ramme: RammeData): string {
  const dokRef = [
    `${esc(ramme.dokumenttype)} — ${esc(ramme.dokumentnavn)}`,
    ramme.dokumentnummer
      ? `<strong style="color:${F.tekst}">${esc(ramme.dokumentnummer)}</strong>`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return `
<div style="width:100%;box-sizing:border-box;padding:${KANT};font-family:Arial,Helvetica,sans-serif;font-size:7px;color:${F.graa};text-align:right">
  <span>${dokRef}</span>
</div>`.trim();
}

/**
 * Bunntekst på HVER side. Generert-stempel (sporbarhetsminimum, § 4) venstre;
 * «Side X av Y» høyre med Chromium-injiserte sidetall. Dokument-id utgår
 * (vedtak 2026-08-16, funn 3) — intern DB-nøkkel, uten verdi på papir.
 */
export function byggRenderFooter(_ramme: RammeData, generertTekst: string): string {
  return `
<div style="width:100%;box-sizing:border-box;padding:${KANT};font-family:Arial,Helvetica,sans-serif;font-size:7px;color:${F.graa};display:flex;justify-content:space-between;align-items:center">
  <span>Generert fra SiteDoc ${esc(generertTekst)}</span>
  <span>Side <span class="pageNumber"></span> av <span class="totalPages"></span></span>
</div>`.trim();
}
