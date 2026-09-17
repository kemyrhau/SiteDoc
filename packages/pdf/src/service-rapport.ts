/**
 * Service-rapport PDF (kundeønske #1, 2026-09-18) — servicelogg for én maskin.
 *
 * Ren HTML-streng, null runtime-avhengigheter (som resten av @sitedoc/pdf).
 * Serveren/klienten eier innholdet; oversatte overskrifter (`tekster`) injiseres
 * fra kall-stedet (klienten har react-i18next `t`) — samme mønster som
 * timer-rapport og arkivmal. Filnavnet bygges også fra `tekster` (i18n gjelder
 * filnavn, CLAUDE.md § Språk).
 */

import { esc } from "./hjelpere";

/** Én servicelogg-rad, ferdig-flatet av kall-stedet (ingen Prisma-typer hit). */
export type ServiceRapportRad = {
  dato: string; // formatert dato (YYYY-MM-DD eller lokalisert)
  type: string; // allerede oversatt type-etikett
  driftstimer: number | null; // timer ved service
  km: number | null;
  beskrivelse: string;
  utfortAv: string | null;
  kostnad: string | null; // ferdig-formatert beløp, null = tom
};

export type ServiceRapportData = {
  firmanavn: string;
  maskinNavn: string; // internNavn/merke+modell — ferdig satt av kall-stedet
  maskinIdent: string | null; // internNummer/regnummer/serienummer, null = tom
  serviceIntervallTimer: number | null;
  nesteServiceTimer: number | null;
  driftstimer: number | null; // gjeldende driftstimer
  rader: ServiceRapportRad[];
  generertDato: string; // formatert dato for "generert"-linja
};

/** Alle synlige strenger (overskrifter/etiketter) — injisert oversatt fra klient. */
export type ServiceRapportTekster = {
  dokumentTittel: string;
  maskin: string;
  ident: string;
  serviceIntervall: string;
  nesteService: string;
  gjeldendeDriftstimer: string;
  timerEnhet: string; // "t" eller "timer"
  servicelogg: string;
  kolDato: string;
  kolType: string;
  kolDriftstimer: string;
  kolKm: string;
  kolBeskrivelse: string;
  kolUtfortAv: string;
  kolKostnad: string;
  ingenData: string;
  ikkeSatt: string;
  generert: string;
};

const CSS = `
body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111827; font-size: 11px; }
.side { padding: 28px 32px; }
.firmanavn { font-size: 13px; font-weight: 700; color: #1e40af; }
.doktittel { font-size: 18px; font-weight: 700; margin: 2px 0 12px; }
.meta { display: flex; flex-wrap: wrap; gap: 4px 20px; margin-bottom: 16px; font-size: 11px; }
.meta span { white-space: nowrap; }
h2 { font-size: 13px; margin: 20px 0 6px; border-bottom: 1px solid #e5e7eb; padding-bottom: 3px; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 5px 6px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
th { background: #f3f4f6; font-size: 10px; text-transform: uppercase; letter-spacing: .02em; }
td.num, th.num { text-align: right; white-space: nowrap; }
.tom { color: #6b7280; font-style: italic; padding: 8px 0; }
.generert { margin-top: 24px; font-size: 9px; color: #9ca3af; }
`;

function metaLinje(etikett: string, verdi: string): string {
  return `<span><b>${esc(etikett)}:</b> ${esc(verdi)}</span>`;
}

function loggTabell(d: ServiceRapportData, t: ServiceRapportTekster): string {
  if (d.rader.length === 0) return `<p class="tom">${esc(t.ingenData)}</p>`;
  const head = `<tr>
    <th>${esc(t.kolDato)}</th>
    <th>${esc(t.kolType)}</th>
    <th class="num">${esc(t.kolDriftstimer)}</th>
    <th class="num">${esc(t.kolKm)}</th>
    <th>${esc(t.kolBeskrivelse)}</th>
    <th>${esc(t.kolUtfortAv)}</th>
    <th class="num">${esc(t.kolKostnad)}</th>
  </tr>`;
  const body = d.rader
    .map(
      (r) => `<tr>
      <td>${esc(r.dato)}</td>
      <td>${esc(r.type)}</td>
      <td class="num">${r.driftstimer != null ? esc(String(r.driftstimer)) : ""}</td>
      <td class="num">${r.km != null ? esc(String(r.km)) : ""}</td>
      <td>${esc(r.beskrivelse)}</td>
      <td>${esc(r.utfortAv ?? "")}</td>
      <td class="num">${esc(r.kostnad ?? "")}</td>
    </tr>`,
    )
    .join("");
  return `<table><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

export function byggServiceRapportHtml(
  d: ServiceRapportData,
  t: ServiceRapportTekster,
): string {
  const enhet = (v: number | null): string =>
    v != null ? `${v} ${t.timerEnhet}` : t.ikkeSatt;

  const meta: string[] = [
    metaLinje(t.maskin, d.maskinNavn),
    ...(d.maskinIdent ? [metaLinje(t.ident, d.maskinIdent)] : []),
    metaLinje(t.gjeldendeDriftstimer, enhet(d.driftstimer)),
    metaLinje(t.serviceIntervall, enhet(d.serviceIntervallTimer)),
    metaLinje(t.nesteService, enhet(d.nesteServiceTimer)),
  ];

  return `<!doctype html><html lang="nb"><head><meta charset="utf-8"><style>${CSS}</style></head>
<body>
  <div class="side">
    <div class="firmanavn">${esc(d.firmanavn)}</div>
    <div class="doktittel">${esc(t.dokumentTittel)}</div>
    <div class="meta">${meta.join("")}</div>
    <h2>${esc(t.servicelogg)}</h2>
    ${loggTabell(d, t)}
    <div class="generert">${esc(t.generert)}: ${esc(d.generertDato)}</div>
  </div>
</body></html>`;
}
