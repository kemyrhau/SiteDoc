/**
 * Timer-rapport PDF — ny mal på den eksisterende HTML→PDF-motoren
 * (arkiv.rendr-rørledningen: `.ark`-HTML → pdf-render-containeren via page.pdf).
 *
 * FASE 1: et DOKUMENT (ikke et regneark på papir) med samme innhold som Excel-
 * eksporten — firmatopp (firmanavn, periode, aktive filtre), sammendrag, så
 * detaljradene. Sidetall + generert-stempel legges av containerens header/footer-
 * template (bygges api-side). ID-kolonnene er BEVISST utelatt — de er
 * koblingsnøkler for databasen, ikke lesestoff for en byggherre.
 *
 * Ren HTML-streng, null runtime-avhengigheter (som resten av @sitedoc/pdf).
 * Serveren eier innholdet; oversatte overskrifter (`tekster`) injiseres fra
 * kall-stedet (klienten har react-i18next `t`) — samme mønster som arkiv.
 */

import { esc } from "./hjelpere";

/* ------------------------------------------------------------------ */
/*  Data + tekster (injisert)                                          */
/* ------------------------------------------------------------------ */

export type TimerRapportAnsatt = {
  navn: string;
  ansattnr: string | null;
  totalTimer: number;
  antallSedler: number;
  sistRegistrert: string | null; // YYYY-MM-DD eller null
  kladd: number;
  sent: number;
  attestert: number;
};

export type TimerRapportMaskin = {
  navn: string;
  timer: number;
  mengde: number | null;
  enhet: string | null;
  radstatus: string;
};

export type TimerRapportTimerad = {
  dato: string;
  ansatt: string;
  ansattnr: string | null;
  prosjekt: string;
  lonnsart: string;
  aktivitet: string;
  timer: number;
  beskrivelse: string | null;
  radstatus: string;
  maskiner: TimerRapportMaskin[];
};

export type TimerRapportLosMaskin = {
  dato: string;
  ansatt: string;
  ansattnr: string | null;
  prosjekt: string;
  navn: string;
  timer: number;
  mengde: number | null;
  enhet: string | null;
  radstatus: string;
};

export type TimerRapportTillegg = {
  dato: string;
  ansatt: string;
  ansattnr: string | null;
  prosjekt: string;
  tillegg: string;
  antall: number;
  kommentar: string | null;
  radstatus: string;
};

export type TimerRapportUtlegg = {
  dato: string;
  ansatt: string;
  ansattnr: string | null;
  prosjekt: string;
  kategori: string;
  belop: number | null;
  kommentar: string | null;
  seddelstatus: string;
};

export type TimerRapportData = {
  firmanavn: string;
  fra: string;
  til: string;
  prosjektFilter: string | null; // navn hvis filtrert, null = alle
  ansattFilter: string | null;
  ansatte: TimerRapportAnsatt[];
  timerader: TimerRapportTimerad[];
  maskinUtenTimerad: TimerRapportLosMaskin[];
  maskinIkkeEksporterbar: TimerRapportLosMaskin[];
  tillegg: TimerRapportTillegg[];
  utlegg: TimerRapportUtlegg[];
};

/** Alle synlige strenger (overskrifter/etiketter) — injisert oversatt fra klient. */
export type TimerRapportTekster = {
  dokumentTittel: string;
  periode: string;
  prosjekt: string;
  ansatt: string;
  alle: string;
  ingenData: string;
  sum: string;
  // Sammendrag
  sammendrag: string;
  kolAnsattnr: string;
  kolTotalTimer: string;
  kolSedler: string;
  kolSistRegistrert: string;
  kolKladd: string;
  kolSent: string;
  kolAttestert: string;
  // Timerader
  timerader: string;
  kolDato: string;
  kolLonnsart: string;
  kolAktivitet: string;
  kolTimer: string;
  kolMaskintimer: string;
  kolBeskrivelse: string;
  kolRadstatus: string;
  kolMengde: string;
  kolEnhet: string;
  maskinUtenTimerad: string;
  maskinIkkeEksporterbar: string;
  // Tillegg
  tillegg: string;
  kolTillegg: string;
  kolAntall: string;
  kolKommentar: string;
  // Utlegg
  utlegg: string;
  kolKategori: string;
  kolBelop: string;
  kolSeddelstatus: string;
};

/* ------------------------------------------------------------------ */
/*  Formatering                                                        */
/* ------------------------------------------------------------------ */

const nf = new Intl.NumberFormat("nb-NO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const tall = (n: number): string => nf.format(n);
const tallEllerTom = (n: number | null): string => (n === null ? "" : nf.format(n));

/* ------------------------------------------------------------------ */
/*  CSS — dokument, ikke regneark                                      */
/* ------------------------------------------------------------------ */

const CSS = `
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111827; font-size: 10px; }
.topp { border-bottom: 2px solid #26327e; padding-bottom: 10px; margin-bottom: 16px; }
.firmanavn { font-size: 18px; font-weight: 700; color: #26327e; }
.doktittel { font-size: 12px; font-weight: 600; margin-top: 2px; }
.meta { margin-top: 6px; font-size: 9px; color: #374151; }
.meta span { margin-right: 16px; }
.meta b { color: #111827; }
h2 { font-size: 12px; color: #26327e; margin: 18px 0 6px; border-bottom: 1px solid #e5e7eb; padding-bottom: 3px; }
table { width: 100%; border-collapse: collapse; }
th { background: #f3f4f6; text-align: left; font-weight: 600; font-size: 8.5px; text-transform: uppercase; letter-spacing: .02em; color: #374151; padding: 4px 5px; border-bottom: 1px solid #d1d5db; }
td { padding: 3px 5px; border-bottom: 1px solid #f0f1f3; vertical-align: top; }
tr { break-inside: avoid; }
.num { text-align: right; font-variant-numeric: tabular-nums; }
.sum td { font-weight: 700; border-top: 1.5px solid #9ca3af; background: #f9fafb; }
.mrk { color: #6b7280; }
.maskin td:first-child { padding-left: 16px; }
.slate { display: inline-block; background: #e2e8f0; color: #475569; font-size: 7.5px; font-weight: 700; text-transform: uppercase; padding: 0 4px; border-radius: 3px; margin-right: 4px; }
.tom { color: #9ca3af; font-style: italic; padding: 8px 0; }
`;

/* ------------------------------------------------------------------ */
/*  Tabeller                                                           */
/* ------------------------------------------------------------------ */

function th(...celler: string[]): string {
  return `<tr>${celler.map((c) => `<th>${c}</th>`).join("")}</tr>`;
}

function sammendragTabell(d: TimerRapportData, t: TimerRapportTekster): string {
  if (d.ansatte.length === 0) return `<p class="tom">${esc(t.ingenData)}</p>`;
  const rader = d.ansatte
    .map(
      (a) => `<tr>
      <td>${esc(a.navn)}</td>
      <td>${esc(a.ansattnr ?? "")}</td>
      <td class="num">${tall(a.totalTimer)}</td>
      <td class="num">${a.antallSedler}</td>
      <td>${esc(a.sistRegistrert ?? "")}</td>
      <td class="num">${a.kladd}</td>
      <td class="num">${a.sent}</td>
      <td class="num">${a.attestert}</td>
    </tr>`,
    )
    .join("");
  const sumTimer = d.ansatte.reduce((s, a) => s + a.totalTimer, 0);
  const sumSedler = d.ansatte.reduce((s, a) => s + a.antallSedler, 0);
  return `<table>
    <thead>${th(t.ansatt, t.kolAnsattnr, t.kolTotalTimer, t.kolSedler, t.kolSistRegistrert, t.kolKladd, t.kolSent, t.kolAttestert)}</thead>
    <tbody>${rader}
      <tr class="sum"><td>${esc(t.sum)}</td><td></td><td class="num">${tall(sumTimer)}</td><td class="num">${sumSedler}</td><td></td><td></td><td></td><td></td></tr>
    </tbody>
  </table>`;
}

function timeraderTabell(d: TimerRapportData, t: TimerRapportTekster): string {
  const harNoe =
    d.timerader.length > 0 ||
    d.maskinUtenTimerad.length > 0 ||
    d.maskinIkkeEksporterbar.length > 0;
  if (!harNoe) return `<p class="tom">${esc(t.ingenData)}</p>`;

  const maskinRad = (m: TimerRapportMaskin): string => `<tr class="maskin mrk">
    <td></td><td></td><td></td><td></td>
    <td><span class="slate">${esc(t.kolMaskintimer)}</span>${esc(m.navn)}</td>
    <td></td>
    <td class="num"></td>
    <td class="num">${tall(m.timer)}</td>
    <td>${m.mengde === null ? "" : `${tall(m.mengde)} ${esc(m.enhet ?? "")}`}</td>
    <td>${esc(m.radstatus)}</td>
  </tr>`;

  const losMaskinRad = (m: TimerRapportLosMaskin, merke: string): string => `<tr class="maskin mrk">
    <td>${esc(m.dato)}</td><td>${esc(m.ansatt)}</td><td>${esc(m.ansattnr ?? "")}</td><td>${esc(m.prosjekt)}</td>
    <td><span class="slate">${esc(merke)}</span>${esc(m.navn)}</td>
    <td></td>
    <td class="num"></td>
    <td class="num">${tall(m.timer)}</td>
    <td>${m.mengde === null ? "" : `${tall(m.mengde)} ${esc(m.enhet ?? "")}`}</td>
    <td>${esc(m.radstatus)}</td>
  </tr>`;

  const rader = d.timerader
    .map(
      (r) => `<tr>
      <td>${esc(r.dato)}</td>
      <td>${esc(r.ansatt)}</td>
      <td>${esc(r.ansattnr ?? "")}</td>
      <td>${esc(r.prosjekt)}</td>
      <td>${esc(r.lonnsart)}</td>
      <td>${esc(r.aktivitet)}</td>
      <td class="num">${tall(r.timer)}</td>
      <td class="num"></td>
      <td>${esc(r.beskrivelse ?? "")}</td>
      <td>${esc(r.radstatus)}</td>
    </tr>${r.maskiner.map(maskinRad).join("")}`,
    )
    .join("");

  const losUten = d.maskinUtenTimerad
    .map((m) => losMaskinRad(m, t.maskinUtenTimerad))
    .join("");
  const losIkke = d.maskinIkkeEksporterbar
    .map((m) => losMaskinRad(m, t.maskinIkkeEksporterbar))
    .join("");

  const sumTimer = d.timerader.reduce((s, r) => s + r.timer, 0);
  const sumMaskin =
    d.timerader.reduce((s, r) => s + r.maskiner.reduce((a, m) => a + m.timer, 0), 0) +
    d.maskinUtenTimerad.reduce((s, m) => s + m.timer, 0) +
    d.maskinIkkeEksporterbar.reduce((s, m) => s + m.timer, 0);

  return `<table>
    <thead>${th(t.kolDato, t.ansatt, t.kolAnsattnr, t.prosjekt, t.kolLonnsart, t.kolAktivitet, t.kolTimer, t.kolMaskintimer, t.kolBeskrivelse, t.kolRadstatus)}</thead>
    <tbody>${rader}${losUten}${losIkke}
      <tr class="sum"><td>${esc(t.sum)}</td><td></td><td></td><td></td><td></td><td></td><td class="num">${tall(sumTimer)}</td><td class="num">${tall(sumMaskin)}</td><td></td><td></td></tr>
    </tbody>
  </table>`;
}

function tilleggTabell(d: TimerRapportData, t: TimerRapportTekster): string {
  if (d.tillegg.length === 0) return `<p class="tom">${esc(t.ingenData)}</p>`;
  const rader = d.tillegg
    .map(
      (r) => `<tr>
      <td>${esc(r.dato)}</td><td>${esc(r.ansatt)}</td><td>${esc(r.ansattnr ?? "")}</td><td>${esc(r.prosjekt)}</td>
      <td>${esc(r.tillegg)}</td><td class="num">${tall(r.antall)}</td><td>${esc(r.kommentar ?? "")}</td><td>${esc(r.radstatus)}</td>
    </tr>`,
    )
    .join("");
  const sum = d.tillegg.reduce((s, r) => s + r.antall, 0);
  return `<table>
    <thead>${th(t.kolDato, t.ansatt, t.kolAnsattnr, t.prosjekt, t.kolTillegg, t.kolAntall, t.kolKommentar, t.kolRadstatus)}</thead>
    <tbody>${rader}
      <tr class="sum"><td>${esc(t.sum)}</td><td></td><td></td><td></td><td></td><td class="num">${tall(sum)}</td><td></td><td></td></tr>
    </tbody>
  </table>`;
}

function utleggTabell(d: TimerRapportData, t: TimerRapportTekster): string {
  if (d.utlegg.length === 0) return `<p class="tom">${esc(t.ingenData)}</p>`;
  const rader = d.utlegg
    .map(
      (r) => `<tr>
      <td>${esc(r.dato)}</td><td>${esc(r.ansatt)}</td><td>${esc(r.ansattnr ?? "")}</td><td>${esc(r.prosjekt)}</td>
      <td>${esc(r.kategori)}</td><td class="num">${tallEllerTom(r.belop)}</td><td>${esc(r.kommentar ?? "")}</td><td>${esc(r.seddelstatus)}</td>
    </tr>`,
    )
    .join("");
  const sum = d.utlegg.reduce((s, r) => s + (r.belop ?? 0), 0);
  return `<table>
    <thead>${th(t.kolDato, t.ansatt, t.kolAnsattnr, t.prosjekt, t.kolKategori, t.kolBelop, t.kolKommentar, t.kolSeddelstatus)}</thead>
    <tbody>${rader}
      <tr class="sum"><td>${esc(t.sum)}</td><td></td><td></td><td></td><td></td><td class="num">${tall(sum)}</td><td></td><td></td></tr>
    </tbody>
  </table>`;
}

/* ------------------------------------------------------------------ */
/*  Dokument                                                          */
/* ------------------------------------------------------------------ */

export function byggTimerRapportHtml(
  d: TimerRapportData,
  t: TimerRapportTekster,
): string {
  const filtre: string[] = [
    `<span><b>${esc(t.periode)}:</b> ${esc(d.fra)}–${esc(d.til)}</span>`,
    `<span><b>${esc(t.prosjekt)}:</b> ${esc(d.prosjektFilter ?? t.alle)}</span>`,
    `<span><b>${esc(t.ansatt)}:</b> ${esc(d.ansattFilter ?? t.alle)}</span>`,
  ];

  return `<!doctype html><html lang="nb"><head><meta charset="utf-8"><style>${CSS}</style></head>
<body>
  <div class="ark-side">
    <div class="topp">
      <div class="firmanavn">${esc(d.firmanavn)}</div>
      <div class="doktittel">${esc(t.dokumentTittel)}</div>
      <div class="meta">${filtre.join("")}</div>
    </div>

    <h2>${esc(t.sammendrag)}</h2>
    ${sammendragTabell(d, t)}

    <h2>${esc(t.timerader)}</h2>
    ${timeraderTabell(d, t)}

    <h2>${esc(t.tillegg)}</h2>
    ${tilleggTabell(d, t)}

    <h2>${esc(t.utlegg)}</h2>
    ${utleggTabell(d, t)}
  </div>
</body></html>`;
}
