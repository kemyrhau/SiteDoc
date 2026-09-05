/**
 * Arkivmal — signaturliste (SJA/HMS-runder). Fabel-ordre 2026-09-06.
 *
 * Hovedtabellen = GJELDENDE runde. F7-prinsippet: «IKKE SIGNERT» og
 * forrige-runde-rader står ALLTID i tabellen — et dokument skal ikke skjule
 * det som mangler. Topplinje: «Runde N (startet <dato>) · X av Y signert ·
 * generert <tidspunkt>». «Med logg»-varianten legger hele runde-historikken
 * under, med dato/årsak og hver rundes signatursett.
 *
 * Data bæres ikke i `felt.verdi` men i egne tabeller — api-sammenstillingen
 * fyller `config.signaturOppslag[objektId]`.
 */

import { esc, formaterDatoTid, formaterSignaturTidspunktPdf } from "../hjelpere";
import type { PdfConfig, SignaturListeData, SignaturListeSignaturData } from "../typer";

const AMBER = "#b45309"; // forrige-runde / ikke signert — teller ikke i X

function hmsKortTekst(sig: SignaturListeSignaturData | undefined): string {
  if (!sig) return "";
  if (sig.hmsKortNr) return esc(sig.hmsKortNr);
  if (sig.harIkkeHmsKort) return `<span class="tom">Har ikke</span>`;
  return "";
}

/** Signeringstidspunkt: veggklokke fra signertTidspunkt, fallback completedAt (UTC). */
function sigTid(sig: SignaturListeSignaturData): string {
  return formaterSignaturTidspunktPdf(sig.signertTidspunkt) ?? formaterDatoTid(sig.completedAt);
}

/** Én rad i hovedtabellen for en deltaker, gitt gjeldende + forrige signatur. */
function hovedRad(
  navn: string,
  firma: string | null,
  gjeldendeRundeNr: number,
  gjeldendeSig: SignaturListeSignaturData | undefined,
  forrigeSig: { rundeNr: number; sig: SignaturListeSignaturData } | undefined,
): string {
  const navnCelle = `<td>${esc(navn)}</td>`;
  const firmaCelle = `<td>${firma ? esc(firma) : `<span class="tom">—</span>`}</td>`;

  if (gjeldendeSig) {
    return `<tr>${navnCelle}${firmaCelle}<td>${hmsKortTekst(gjeldendeSig)}</td>` +
      `<td>${esc(sigTid(gjeldendeSig))}</td>` +
      `<td>${gjeldendeRundeNr}</td></tr>`;
  }
  if (forrigeSig) {
    // Signerte i en tidligere runde, men ikke gjeldende — vises amber, teller ikke i X.
    return `<tr style="color:${AMBER}">${navnCelle}${firmaCelle}<td>${hmsKortTekst(forrigeSig.sig)}</td>` +
      `<td>${esc(sigTid(forrigeSig.sig))}</td>` +
      `<td>Runde ${forrigeSig.rundeNr} (forrige)</td></tr>`;
  }
  return `<tr style="color:${AMBER}">${navnCelle}${firmaCelle}<td></td>` +
    `<td><strong>IKKE SIGNERT</strong></td><td>${gjeldendeRundeNr}</td></tr>`;
}

function byggLoggseksjon(data: SignaturListeData): string {
  const navnFor = new Map(data.deltakere.map((d) => [d.id, d]));
  const runder = [...data.runder].sort((a, b) => a.rundeNr - b.rundeNr);
  let html = `<div class="felt-label" style="margin-top:10px">Signaturlogg — alle runder</div>`;
  for (const r of runder) {
    const start = r.startetAt ? esc(formaterDatoTid(r.startetAt)) : "";
    const slutt = r.avsluttetAt ? ` – avsluttet ${esc(formaterDatoTid(r.avsluttetAt))}` : " – åpen";
    const aarsak = r.aarsak ? ` · ${esc(r.aarsak)}` : "";
    html += `<div style="margin-top:6px;font-size:10px"><strong>Runde ${r.rundeNr}</strong> — startet ${start}${slutt}${aarsak}</div>`;
    if (r.signaturer.length === 0) {
      html += `<div class="tom" style="font-size:9.5px">Ingen signaturer i denne runden</div>`;
      continue;
    }
    html += `<table class="ark-repeater"><thead><tr><th>Navn</th><th>Firma</th><th>HMS-kort</th><th>Signert</th></tr></thead><tbody>`;
    for (const s of r.signaturer) {
      const d = navnFor.get(s.deltakerId);
      html += `<tr><td>${esc(d?.navn ?? "Ukjent")}</td><td>${d?.firma ? esc(d.firma) : `<span class="tom">—</span>`}</td>` +
        `<td>${hmsKortTekst(s)}</td><td>${esc(sigTid(s))}</td></tr>`;
    }
    html += `</tbody></table>`;
  }
  return html;
}

/** Bygg signaturliste-blokken (label + topplinje + hovedtabell + evt. logg). */
export function byggSignaturListe(
  label: string,
  objektId: string,
  config: PdfConfig,
): string {
  const data = config.signaturOppslag?.[objektId];
  if (!data || data.runder.length === 0) {
    return config.visTommeStrukturer
      ? `<div class="felt-blokk"><div class="felt-label">${esc(label)}</div><div class="tom">Ingen signaturrunder registrert</div></div>`
      : "";
  }

  const gjeldende =
    data.runder.find((r) => r.erGjeldende) ?? data.runder[data.runder.length - 1]!;
  const gjeldendeSig = new Map(gjeldende.signaturer.map((s) => [s.deltakerId, s]));

  // Siste signatur i en TIDLIGERE runde per deltaker (for forrige-runde-rad).
  const forrigePerDeltaker = new Map<string, { rundeNr: number; sig: SignaturListeSignaturData }>();
  for (const r of data.runder) {
    if (r.rundeNr >= gjeldende.rundeNr) continue;
    for (const s of r.signaturer) {
      const eks = forrigePerDeltaker.get(s.deltakerId);
      if (!eks || r.rundeNr > eks.rundeNr) forrigePerDeltaker.set(s.deltakerId, { rundeNr: r.rundeNr, sig: s });
    }
  }

  // Rader = deltakere som er aktive nå ELLER har signert i en runde (aldri skjul historikk).
  const harSignert = new Set<string>();
  for (const r of data.runder) for (const s of r.signaturer) harSignert.add(s.deltakerId);
  const rader = data.deltakere.filter((d) => d.aktiv || harSignert.has(d.id));

  const start = gjeldende.startetAt ? esc(formaterDatoTid(gjeldende.startetAt)) : "";
  const generert = config.signaturGenerertTidspunkt
    ? ` · generert ${esc(formaterDatoTid(config.signaturGenerertTidspunkt))}`
    : "";
  const topplinje = `Runde ${gjeldende.rundeNr} (startet ${start}) · ${data.status.signert} av ${data.status.av} signert${generert}`;

  let html = `<div class="felt-blokk"><div class="felt-label">${esc(label)}</div>`;
  html += `<div style="font-size:10px;margin-bottom:4px">${topplinje}</div>`;
  html += `<table class="ark-repeater"><thead><tr><th>Navn</th><th>Firma</th><th>HMS-kort</th><th>Signert</th><th>Runde</th></tr></thead><tbody>`;
  for (const d of rader) {
    html += hovedRad(d.navn, d.firma, gjeldende.rundeNr, gjeldendeSig.get(d.id), forrigePerDeltaker.get(d.id));
  }
  html += `</tbody></table>`;

  if (config.signaturMedLogg) html += byggLoggseksjon(data);

  html += `</div>`;
  return html;
}
