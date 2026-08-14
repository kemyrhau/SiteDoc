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

/* Innhold — generiske felt (felt.ts-output), stylet i arkiv-uttrykk */
.felt-blokk{margin-top:10px}
.felt-label{font-size:9px;letter-spacing:0.06em;text-transform:uppercase;color:${f.graa};margin-bottom:2px}
.felt-verdi{color:${f.celletekst}}
.tom{color:${f.svak}}
.tekst-verdi{color:${f.celletekst}}
.kommentar{font-size:9.5px;color:${f.graa};margin-top:2px}
.heading{font-size:9px;letter-spacing:0.1em;text-transform:uppercase;color:${f.navy};font-weight:600;border-bottom:2px solid ${f.navy};padding-bottom:4px;margin-top:14px}
.subtitle{font-size:10px;font-weight:600;color:${f.celletekst};margin-top:8px}
.trafikklys{display:inline-block;width:9px;height:9px;border-radius:50%;vertical-align:middle}
.vedlegg-teller{font-size:9.5px;color:${f.graa};margin-top:4px}

/* Repeater som tabell (arkiv-override) */
.ark-repeater{width:100%;border-collapse:collapse;margin-top:6px;font-size:10.5px}
.ark-repeater th{text-align:left;color:${f.navy};border-bottom:2px solid ${f.navy};padding:5px 8px}
.ark-repeater td{border-bottom:1px solid ${f.radLinje};padding:6px 8px;color:${f.celletekst};vertical-align:top}
.ark-rad-nr{width:24px;color:${f.graa}}

/* Bilder — inline i lesbar størrelse, 2-kolonners */
.bilde-rutenett{display:flex;gap:10px;flex-wrap:wrap;margin-top:6px}
.bilde-kort{flex:1;min-width:45%;border:1px solid ${f.radLinje};padding:8px 10px;position:relative}
.bilde-img{max-width:100%;height:auto;display:block}
.bilde-nr{position:absolute;top:4px;right:6px;font-size:9px;color:${f.svak}}

/* Loggseksjon — Dokumenthistorikk + Endringslogg (økt-gruppert) */
.ark-logg{width:100%;border-collapse:collapse;margin-top:6px;font-size:9.5px}
.ark-logg td{padding:4px 8px;border-bottom:1px solid ${f.svakLinje}}
.ark-logg-tid{color:${f.graa};white-space:nowrap}
.ark-okt{padding:6px 8px 4px !important;background:${f.statusBg};border-bottom:1px solid ${f.radLinje};font-weight:700;color:${f.tekst}}

/* Signaturblokk */
.ark-signatur{display:flex;gap:10px;margin-top:16px;padding-top:16px}
.ark-sign-felt{flex:1}
.ark-sign-navn{font-family:'Caveat',cursive;font-size:22px;color:${f.signatur};padding:0 4px 2px;min-height:26px}
.ark-sign-tom{min-height:26px}
.ark-sign-strek{border-top:1px solid ${f.signatur};padding-top:3px;font-size:9px;color:${f.graa}}
.ark-svak{color:${f.svak}}

/* Mangel-merknad (vedtak c) — utvetydig, S/H-lesbar (border+tekst bærer, ikke bare farge) */
.ark-mangel{margin-top:12px;border:1.5px solid ${f.rod};padding:8px 12px;font-size:10px;font-weight:600;color:${f.rod}}

/* Sideskift — ingen radbryting midt i tabellrad ved paginering */
tr,.ark-ingen-brekk{break-inside:avoid;page-break-inside:avoid}
thead{display:table-header-group}

/* Merk: ingen @page :first-regel. Verifisert 2026-08-15 at page.pdf({ margin })
   i pdf-render-containeren overstyrer @page-margin, så CSS kan ikke skjule
   margin-headeren på side 1. Dubleringen er i stedet løst ved at margin-headeren
   bærer kun dokumentreferanse (render-templates.ts), ikke firma/prosjekt. */
`.trim();
}
