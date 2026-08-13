/**
 * Arkivmal — stilark (RENT LAG). Transkribert fra den fabel-godkjente mockupen
 * (`docs/redesign/dokumentgenerering/Arkivmal PDF Mockup.dc.html`, commit c4a62ab4).
 *
 * Klassebasert så ramme-funksjonene emitterer ren HTML. Fonten ('IBM Plex Sans'
 * + 'Caveat' for signatur) leveres av rendrer-containeren (Stage 4) — ingen
 * ekstern @import her (CSP-streng container, ingen nett).
 */

/** Farger — én kilde, speiler mockupen + SiteDoc-paletten. */
export const ARKIV_FARGER = {
  navy: "#26327e",
  gronn: "#15803d",
  rod: "#b91c1c",
  tekst: "#111827",
  celletekst: "#374151",
  graa: "#6b7280",
  svak: "#9ca3af",
  signatur: "#1f2937",
  rammeLinje: "#c7cbd4",
  radLinje: "#e2e4ea",
  svakLinje: "#eef0f4",
  statusBg: "#f5f6f9",
  flateBg: "#eef0f4",
} as const;

export function hentArkivCss(): string {
  const f = ARKIV_FARGER;
  return `
*{box-sizing:border-box}
body{margin:0;font-family:'IBM Plex Sans',sans-serif;color:${f.tekst};font-size:10.5px;line-height:1.45}
.ark-side{padding:15mm 16mm 10mm;color:${f.tekst};font-size:10.5px;line-height:1.45}

/* Topptekst (side 1) */
.ark-topptekst{display:flex;justify-content:space-between;align-items:center;border:1px solid ${f.rammeLinje};padding:10px 14px}
.ark-tt-venstre{display:flex;align-items:center;gap:12px}
.ark-logo{width:38px;height:38px;border-radius:8px;object-fit:contain}
.ark-firmanavn{font-size:13px;font-weight:700}
.ark-orgnr{font-size:9.5px;color:${f.graa}}
.ark-tt-hoyre{text-align:right}
.ark-dok-type{font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:${f.navy};font-weight:600}
.ark-dok-navn{font-size:13px;font-weight:700}
.ark-dok-nr{font-size:9.5px;color:${f.graa}}

/* Prosjektblokk — komprimeres (auto-fit) når kolonner faller bort */
.ark-prosjektblokk{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;border:1px solid ${f.rammeLinje};border-top:none;padding:8px 14px;gap:4px 20px}
.ark-etikett{color:${f.graa}}

/* Statusblokk */
.ark-statusblokk{display:flex;gap:16px;border:1px solid ${f.rammeLinje};border-top:none;padding:8px 14px;background:${f.statusBg}}
.ark-status-celle{flex:1}
.ark-gronn{color:${f.gronn}}
.ark-rod{color:${f.rod}}

/* Seksjonsheading (innhold + logg) */
.ark-seksjon{font-size:9px;letter-spacing:0.1em;text-transform:uppercase;color:${f.navy};font-weight:600;border-bottom:2px solid ${f.navy};padding-bottom:4px}
.ark-seksjon-note{text-transform:none;letter-spacing:0;color:${f.graa};font-weight:400}

/* Fortsettelses-header (slank, side 2+) — brukes som Playwright headerTemplate */
.ark-fortsettelse{display:flex;justify-content:space-between;align-items:center;border:1px solid ${f.rammeLinje};padding:8px 14px}
.ark-fs-venstre{display:flex;align-items:center;gap:10px}
.ark-fs-logo{width:28px;height:28px;border-radius:6px;object-fit:contain}
.ark-fs-firma{font-size:11px;font-weight:700}
.ark-fs-hoyre{text-align:right;font-size:9.5px;color:${f.graa}}

/* Bunntekst — generert-stempel + dokument-id (sporbarhet, kan ikke velges bort) */
.ark-footer{display:flex;justify-content:space-between;border-top:1px solid ${f.radLinje};padding-top:5px;font-size:8.5px;color:${f.svak}}

/* Sideskift — ingen radbryting midt i tabellrad ved paginering */
tr,.ark-ingen-brekk{break-inside:avoid;page-break-inside:avoid}
thead{display:table-header-group}
`.trim();
}
