/**
 * Komplett CSS for PDF-generering.
 * Returnerer CSS-streng som bakes inn i <style>-tag.
 */

import type { PdfConfig } from "./typer";

export function hentCss(config?: Partial<PdfConfig>): string {
  const maksHoyde = config?.maksbildeHoyde ?? 260;
  const visSidenummer = config?.visSidenummer ?? false;

  return `
  @page { margin: 12mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    display: block !important;
    height: auto !important;
    min-height: 0 !important;
    overflow: visible !important;
    font-family: -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif;
    font-size: 10px;
    color: #1a1a1a;
    line-height: 1.4;
  }

  /* Tittel */
  .doc-tittel {
    font-size: 16px;
    font-weight: 700;
    color: #111827;
  }

  /* Tittel-rad med logo */
  .tittel-rad {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 10px;
  }
  .tittel-logo {
    max-height: 48px;
    max-width: 120px;
    object-fit: contain;
  }

  /* Metadata-rutenett — 4 kolonner */
  .meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    margin-bottom: 14px;
    overflow: hidden;
  }
  .meta-celle {
    padding: 5px 8px;
    border-right: 1px solid #e5e7eb;
    border-bottom: 1px solid #e5e7eb;
  }
  .meta-celle:nth-child(4n) { border-right: none; }
  .meta-celle:nth-last-child(-n+4) { border-bottom: none; }
  .meta-etikett {
    font-size: 8px;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  .meta-verdi { font-size: 10px; color: #111827; margin-top: 1px; }
  .status-badge {
    display: inline-block;
    padding: 1px 8px;
    border-radius: 3px;
    font-size: 9px;
    font-weight: 600;
  }

  /* Felt-blokker */
  .felter {
    display: block;
  }
  .felt-blokk {
    border-bottom: 1px solid #e5e7eb;
    padding: 8px 0;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .felt-label {
    font-size: 10px;
    font-weight: 600;
    color: #374151;
    margin-bottom: 4px;
  }
  .felt-verdi {
    font-size: 10px;
    color: #111827;
    margin-top: 4px;
  }

  .heading {
    background: #f3f4f6;
    font-size: 12px;
    font-weight: 700;
    padding: 7px 8px;
    color: #111827;
    border-bottom: 2px solid #d1d5db;
    margin-top: 6px;
    page-break-after: avoid;
    break-after: avoid;
  }
  .subtitle {
    font-size: 10px;
    font-weight: 600;
    color: #6b7280;
    padding: 5px 8px;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
    page-break-after: avoid;
    break-after: avoid;
  }

  .tom { color: #d1d5db; font-style: italic; }
  .tekst-verdi { white-space: pre-wrap; }
  .kommentar { margin-top: 4px; font-size: 9px; font-style: italic; color: #6b7280; }
  .vedlegg-teller { margin-top: 4px; font-size: 9px; color: #9ca3af; }

  /* Trafikklys */
  .trafikklys {
    display: inline-block;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    vertical-align: middle;
    margin-right: 4px;
  }

  /* Bilde-rutenett — 2 kolonner med nummerering */
  .bilde-rutenett {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 6px 0;
  }
  .bilde-kort {
    position: relative;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    overflow: hidden;
    width: calc(50% - 3px);
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .bilde-img {
    width: 100%;
    height: auto;
    display: block;
    object-fit: contain;
    max-height: ${maksHoyde}px;
    background: #f9fafb;
  }
  .bilde-nr {
    position: absolute;
    top: 4px;
    left: 4px;
    background: rgba(0,0,0,0.6);
    color: #fff;
    font-size: 9px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 3px;
  }

  /* Repeater */
  .repeater-rad {
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    padding: 6px 8px;
    margin-bottom: 4px;
  }
  .repeater-nr {
    font-size: 9px;
    font-weight: 600;
    color: #9ca3af;
    margin-bottom: 2px;
  }

  /* Tegningsposisjon (SVG-fallback) */
  .tegning-container {
    display: flex;
    gap: 6px;
    margin-bottom: 10px;
  }
  .tegning-celle {
    flex: 1;
    position: relative;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    overflow: hidden;
    height: 260px;
  }
  .tegning-celle img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .tegning-markør {
    position: absolute;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #ef4444;
    border: 2px solid white;
    transform: translate(-50%, -50%);
  }
  .tegning-etikett {
    position: absolute;
    bottom: 4px;
    left: 4px;
    background: rgba(255,255,255,0.8);
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 9px;
    font-weight: 500;
    color: #6b7280;
  }

  /* Header-ramme */
  .header-ramme {
    border: 1px solid #d1d5db;
    margin-bottom: 14px;
  }
  .header-rad {
    display: flex;
    align-items: start;
    justify-content: space-between;
    padding: 8px 16px;
    border-bottom: 1px solid #d1d5db;
  }
  .header-rad:last-child { border-bottom: none; }

  /* Signatur */
  img { max-width: 100%; }

  /* Beskrivelse (oppgave) */
  .beskrivelse {
    font-size: 10px;
    color: #374151;
    padding: 6px 16px;
    border-bottom: 1px solid #d1d5db;
  }

  /* Prioritet-badge */
  .prioritet {
    font-size: 9px;
    color: #6b7280;
  }

  /* Sideskift etter tegning */
  .tegning-sideskift {
    page-break-after: always;
    break-after: always;
    height: 0;
  }

  /* Table-layout for gjentakende header/footer (kun nettleser) */
  .print-tabell {
    width: 100%;
    border-collapse: collapse;
  }
  .print-tabell td {
    padding: 0;
    vertical-align: top;
  }

${visSidenummer ? `
  .print-footer {
    height: 10mm;
    text-align: right;
    font-size: 10px;
    color: #6b7280;
    padding-top: 4mm;
    border-top: 1px solid #e5e7eb;
    margin-top: 4mm;
  }
  .print-footer::after {
    counter-increment: page;
    content: "Side " counter(page);
  }
` : `
  .print-footer { display: none; }
`}
`;
}
