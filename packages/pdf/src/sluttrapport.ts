/**
 * Sluttrapport PDF — kontrollplan per kontrollområde (SAK10 §14-7)
 */

import { hentCss } from "./css";
import { esc } from "./hjelpere";

export interface SluttrapportPunkt {
  omradeNavn: string;
  malNavn: string;
  status: string;
  faggruppe: string;
  godkjentDato: string | null;
  avvikKommentarer: string[];
}

export interface SluttrapportData {
  kontrollplanNavn: string;
  byggeplassNavn: string;
  kontrollomrade: string | null;
  dato: string;
  punkter: SluttrapportPunkt[];
  prosjektNavn: string;
  prosjektNummer: string;
}

const KONTROLLOMRADE_NAVN: Record<string, string> = {
  fukt: "Fuktsikring",
  brann: "Brannsikkerhet",
  konstruksjon: "Konstruksjonssikkerhet",
  geo: "Geoteknikk",
  grunnarbeid: "Grunnarbeider",
  sha: "SHA (sikkerhet, helse, arbeidsmiljø)",
};

const STATUS_TEKST: Record<string, string> = {
  planlagt: "Planlagt",
  pagar: "Pågår",
  utfort: "Utført",
  godkjent: "Godkjent",
};

export function genererSluttrapportHtml(data: SluttrapportData): string {
  const omradeNavn = data.kontrollomrade
    ? KONTROLLOMRADE_NAVN[data.kontrollomrade] ?? data.kontrollomrade
    : "Alle kontrollområder";

  const total = data.punkter.length;
  const godkjent = data.punkter.filter((p) => p.status === "godkjent").length;
  const avvikTotalt = data.punkter.reduce((s, p) => s + p.avvikKommentarer.length, 0);
  const aapneAvvik = data.punkter.filter((p) => p.status !== "godkjent" && p.avvikKommentarer.length > 0).length;

  // Grupper etter område
  const omrader = new Map<string, SluttrapportPunkt[]>();
  for (const p of data.punkter) {
    if (!omrader.has(p.omradeNavn)) omrader.set(p.omradeNavn, []);
    omrader.get(p.omradeNavn)!.push(p);
  }

  return `<!DOCTYPE html>
<html lang="nb">
<head>
  <meta charset="UTF-8">
  <title>Sluttrapport — ${esc(omradeNavn)}</title>
  ${hentCss({})}
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 11px; color: #1f2937; margin: 0; padding: 20px; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    h2 { font-size: 14px; margin: 24px 0 8px; border-bottom: 1px solid #d1d5db; padding-bottom: 4px; }
    h3 { font-size: 12px; margin: 16px 0 4px; color: #4b5563; }
    .meta { color: #6b7280; font-size: 10px; margin-bottom: 16px; }
    .meta span { margin-right: 16px; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; }
    th, td { text-align: left; padding: 4px 8px; border: 1px solid #e5e7eb; font-size: 10px; }
    th { background: #f9fafb; font-weight: 600; }
    .badge { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 9px; font-weight: 600; }
    .badge-godkjent { background: #d1fae5; color: #065f46; }
    .badge-utfort { background: #fef3c7; color: #92400e; }
    .badge-pagar { background: #dbeafe; color: #1e40af; }
    .badge-planlagt { background: #f3f4f6; color: #4b5563; }
    .oppsummering { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px 16px; margin: 12px 0; }
    .oppsummering .tall { font-size: 20px; font-weight: 700; }
    .oppsummering .label { font-size: 9px; color: #6b7280; text-transform: uppercase; }
    .flex { display: flex; gap: 24px; }
    .signatur { margin-top: 40px; display: flex; gap: 40px; }
    .signatur-felt { flex: 1; border-top: 1px solid #1f2937; padding-top: 4px; font-size: 10px; color: #6b7280; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>SLUTTRAPPORT</h1>
  <div style="font-size: 14px; font-weight: 600; color: #1e40af; margin-bottom: 4px;">Kontrollområde: ${esc(omradeNavn)}</div>
  <div class="meta">
    <span>${esc(data.kontrollplanNavn)}</span>
    <span>${esc(data.byggeplassNavn)}</span>
    <span>Prosjekt: ${esc(data.prosjektNavn)} (${esc(data.prosjektNummer)})</span>
    <span>Dato: ${esc(data.dato)}</span>
  </div>

  <h2>1. Oppsummering</h2>
  <div class="oppsummering flex">
    <div><div class="tall">${total}</div><div class="label">Kontrollert</div></div>
    <div><div class="tall">${godkjent}</div><div class="label">Godkjent</div></div>
    <div><div class="tall">${avvikTotalt}</div><div class="label">Avvik totalt</div></div>
    <div><div class="tall">${aapneAvvik}</div><div class="label">Åpne avvik</div></div>
  </div>

  <h2>2. Kontrollerte områder</h2>
  <table>
    <thead>
      <tr>
        <th>Område</th>
        <th>Sjekkliste</th>
        <th>Status</th>
        <th>Godkjent dato</th>
        <th>Faggruppe</th>
      </tr>
    </thead>
    <tbody>
      ${data.punkter.map((p) => `
      <tr>
        <td>${esc(p.omradeNavn)}</td>
        <td>${esc(p.malNavn)}</td>
        <td><span class="badge badge-${p.status}">${STATUS_TEKST[p.status] ?? p.status}</span></td>
        <td>${p.godkjentDato ? esc(p.godkjentDato) : "—"}</td>
        <td>${esc(p.faggruppe)}</td>
      </tr>`).join("")}
    </tbody>
  </table>

  ${avvikTotalt > 0 ? `
  <h2>3. Avvik og lukking</h2>
  ${[...omrader.entries()]
    .filter(([_, pp]) => pp.some((p) => p.avvikKommentarer.length > 0))
    .map(([omr, pp]) => `
    <h3>${esc(omr)}</h3>
    ${pp.filter((p) => p.avvikKommentarer.length > 0).map((p) => `
    <div style="margin: 4px 0 4px 8px; font-size: 10px;">
      <strong>${esc(p.malNavn)}</strong> — ${p.avvikKommentarer.map((k) => esc(k)).join("; ")}
      ${p.status === "godkjent" ? '<span class="badge badge-godkjent">Lukket</span>' : '<span class="badge badge-pagar">Åpen</span>'}
    </div>`).join("")}`).join("")}
  ` : ""}

  <h2>${avvikTotalt > 0 ? "4" : "3"}. Kontrollerklæring</h2>
  <p>Kontrollområde <strong>${esc(omradeNavn)}</strong> er gjennomført iht. SAK10 §14-7.</p>
  <p>${godkjent === total ? "Alle kontrollpunkter er godkjent." : `${godkjent} av ${total} kontrollpunkter er godkjent. ${total - godkjent} gjenstår.`}</p>
  ${avvikTotalt > 0 ? `<p>Totalt ${avvikTotalt} avvik er registrert. ${aapneAvvik === 0 ? "Alle avvik er dokumentert og lukket." : `${aapneAvvik} avvik er fortsatt åpne.`}</p>` : ""}

  <div class="signatur">
    <div class="signatur-felt">Ansvarlig kontrollerende<br><br>Dato: ____________</div>
    <div class="signatur-felt">Prosjektleder<br><br>Dato: ____________</div>
  </div>
</body>
</html>`;
}
