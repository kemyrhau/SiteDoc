/**
 * Header-generator for PDF — brukes av både sjekkliste og oppgave.
 * Returnerer HTML-streng med prosjektinfo, logo, fra→til, vær.
 */

import type { ProsjektForPdf, Utskriftsinnstillinger, PdfConfig } from "./typer";
import { STATUS_TEKST, STATUS_FARGE } from "./konstanter";
import { esc, formaterDatoKort, formaterDatoTidKort, fullBildeUrl } from "./hjelpere";

// ---------------------------------------------------------------------------
//  Sjekkliste-header
// ---------------------------------------------------------------------------

export interface SjekklisteHeaderData {
  tittel: string;
  nummer: string | null;
  status: string;
  bestillerNavn?: string | null;
  bestillerFaggruppe?: string | null;
  utforerFaggruppe?: string | null;
  byggeplassNavn?: string | null;
  tegningNavn?: string | null;
  opprettetDatoTid?: string;
  endretDatoTid?: string;
  endretAv?: string;
  opprettetAv?: string;
  vaerTekst?: string | null;
}

export function byggSjekklisteHeader(
  data: SjekklisteHeaderData,
  prosjekt: ProsjektForPdf | null | undefined,
  innstillinger: Utskriftsinnstillinger | null | undefined,
  config: PdfConfig,
): string {
  const vis = (felt: keyof Utskriftsinnstillinger) => innstillinger?.[felt] ?? true;

  const prosjektNr = vis("eksternProsjektnummer") && prosjekt?.externalProjectNumber
    ? prosjekt.externalProjectNumber
    : prosjekt?.projectNumber ?? "";

  const statusTekst = STATUS_TEKST[data.status] ?? data.status;
  const statusFarge = STATUS_FARGE[data.status] ?? "background:#e5e7eb;color:#374151;";

  // Logo
  const logoHtml = vis("logo") && prosjekt?.logoUrl
    ? `<img src="${esc(fullBildeUrl(prosjekt.logoUrl, config.bildeBaseUrl))}" class="tittel-logo" />`
    : "";

  // Lokasjon + tegning
  const lokTegn: string[] = [];
  if (vis("lokasjon") && data.byggeplassNavn) lokTegn.push(data.byggeplassNavn);
  if (vis("tegningsnummer") && data.tegningNavn) lokTegn.push(data.tegningNavn);

  // Fra → til
  let fraFilHtml = "";
  if (vis("fraTil") && data.bestillerFaggruppe) {
    const fra = data.bestillerNavn
      ? `${esc(data.bestillerNavn)} (${esc(data.bestillerFaggruppe)})`
      : esc(data.bestillerFaggruppe);
    const til = data.utforerFaggruppe ? ` → ${esc(data.utforerFaggruppe)}` : "";
    fraFilHtml = `<div style="font-size:10px;color:#4b5563;">${fra}${til}</div>`;
  }

  return `
<div class="header-ramme">
  <!-- Rad 1: Logo + prosjektinfo + dato -->
  <div class="header-rad">
    <div style="display:flex;align-items:start;gap:12px;">
      ${logoHtml}
      <div>
        ${(prosjektNr || vis("prosjektnavn")) ? `<div style="font-size:14px;font-weight:700;color:#111827;">${prosjektNr ? esc(prosjektNr) : ""}${prosjektNr && vis("prosjektnavn") ? " · " : ""}${vis("prosjektnavn") ? esc(prosjekt?.name ?? "") : ""}</div>` : ""}
        ${lokTegn.length > 0 ? `<div style="font-size:10px;color:#6b7280;">${esc(lokTegn.join(" · "))}</div>` : ""}
      </div>
    </div>
    <div style="font-size:10px;color:#4b5563;white-space:nowrap;">${esc(data.opprettetDatoTid ?? "")}</div>
  </div>

  <!-- Rad 2: Dokumenttittel + fra→til + nummer -->
  <div class="header-rad">
    <div>
      <div style="font-size:12px;font-weight:600;color:#111827;">${esc(data.tittel)}</div>
      ${fraFilHtml}
    </div>
    <div style="text-align:right;">
      ${data.nummer ? `<div style="font-size:12px;font-weight:500;color:#374151;">${esc(data.nummer)}</div>` : ""}
      <div><span class="status-badge" style="${statusFarge}">${esc(statusTekst)}</span></div>
    </div>
  </div>

  <!-- Rad 3: Vær (valgfri) -->
  ${vis("vaer") && data.vaerTekst ? `<div style="padding:4px 16px;font-size:10px;color:#4b5563;">${esc(data.vaerTekst)}</div>` : ""}
</div>`;
}

// ---------------------------------------------------------------------------
//  Oppgave-header
// ---------------------------------------------------------------------------

export interface OppgaveHeaderData {
  tittel: string;
  nummer: string | null;
  status: string;
  prioritet?: string | null;
  visPrioritet?: boolean;
  beskrivelse?: string | null;
  bestillerNavn?: string | null;
  bestillerFaggruppe?: string | null;
  utforerFaggruppe?: string | null;
  byggeplassNavn?: string | null;
  tegningNavn?: string | null;
  opprettetDatoTid?: string;
}

export function byggOppgaveHeader(
  data: OppgaveHeaderData,
  prosjekt: ProsjektForPdf | null | undefined,
  innstillinger: Utskriftsinnstillinger | null | undefined,
  config: PdfConfig,
): string {
  const vis = (felt: keyof Utskriftsinnstillinger) => innstillinger?.[felt] ?? true;

  const prosjektNr = vis("eksternProsjektnummer") && prosjekt?.externalProjectNumber
    ? prosjekt.externalProjectNumber
    : prosjekt?.projectNumber ?? "";

  const statusTekst = STATUS_TEKST[data.status] ?? data.status;
  const statusFarge = STATUS_FARGE[data.status] ?? "background:#e5e7eb;color:#374151;";

  const logoHtml = vis("logo") && prosjekt?.logoUrl
    ? `<img src="${esc(fullBildeUrl(prosjekt.logoUrl, config.bildeBaseUrl))}" class="tittel-logo" />`
    : "";

  const lokTegn: string[] = [];
  if (vis("lokasjon") && data.byggeplassNavn) lokTegn.push(data.byggeplassNavn);
  if (vis("tegningsnummer") && data.tegningNavn) lokTegn.push(data.tegningNavn);

  let fraFilHtml = "";
  if (vis("fraTil") && data.bestillerFaggruppe) {
    const fra = data.bestillerNavn
      ? `${esc(data.bestillerNavn)} (${esc(data.bestillerFaggruppe)})`
      : esc(data.bestillerFaggruppe);
    const til = data.utforerFaggruppe ? ` → ${esc(data.utforerFaggruppe)}` : "";
    fraFilHtml = `<div style="font-size:10px;color:#4b5563;">${fra}${til}</div>`;
  }

  // Prioritet-tekst
  const PRIO: Record<string, string> = { low: "Lav", medium: "Medium", high: "Høy", critical: "Kritisk" };
  const prioTekst = data.visPrioritet !== false && data.prioritet ? PRIO[data.prioritet] ?? data.prioritet : null;

  return `
<div class="header-ramme">
  <!-- Rad 1: Logo + prosjektinfo + dato -->
  <div class="header-rad">
    <div style="display:flex;align-items:start;gap:12px;">
      ${logoHtml}
      <div>
        ${(prosjektNr || vis("prosjektnavn")) ? `<div style="font-size:14px;font-weight:700;color:#111827;">${prosjektNr ? esc(prosjektNr) : ""}${prosjektNr && vis("prosjektnavn") ? " · " : ""}${vis("prosjektnavn") ? esc(prosjekt?.name ?? "") : ""}</div>` : ""}
        ${lokTegn.length > 0 ? `<div style="font-size:10px;color:#6b7280;">${esc(lokTegn.join(" · "))}</div>` : ""}
      </div>
    </div>
    <div style="font-size:10px;color:#4b5563;white-space:nowrap;">${esc(data.opprettetDatoTid ?? "")}</div>
  </div>

  <!-- Rad 2: Dokumenttittel + fra→til + nummer + prioritet -->
  <div class="header-rad">
    <div>
      <div style="font-size:12px;font-weight:600;color:#111827;">${esc(data.tittel)}</div>
      ${fraFilHtml}
    </div>
    <div style="text-align:right;">
      ${data.nummer ? `<div style="font-size:12px;font-weight:500;color:#374151;">${esc(data.nummer)}</div>` : ""}
      ${prioTekst ? `<div class="prioritet">${esc(prioTekst)}</div>` : ""}
      <div><span class="status-badge" style="${statusFarge}">${esc(statusTekst)}</span></div>
    </div>
  </div>

  <!-- Rad 3: Beskrivelse (valgfri) -->
  ${data.beskrivelse ? `<div class="beskrivelse">${esc(data.beskrivelse)}</div>` : ""}
</div>`;
}

// ---------------------------------------------------------------------------
//  Metadata-rutenett (4×2, brukes av mobil)
// ---------------------------------------------------------------------------

export interface MetadataRutenettData {
  prosjektNavn?: string;
  prosjektNr?: string;
  bygningNavn?: string;
  opprettetAv?: string;
  opprettetDatoTid?: string;
  endretAv?: string;
  endretDatoTid?: string;
  status: string;
}

export function byggMetadataRutenett(data: MetadataRutenettData): string {
  const statusTekst = STATUS_TEKST[data.status] ?? data.status;
  const statusFarge = STATUS_FARGE[data.status] ?? "background:#e5e7eb;color:#374151;";

  return `
<div class="meta-grid">
  <div class="meta-celle">
    <div class="meta-etikett">Prosjekt</div>
    <div class="meta-verdi">${esc(data.prosjektNavn ?? "")}</div>
  </div>
  <div class="meta-celle">
    <div class="meta-etikett">Prosjekt nr</div>
    <div class="meta-verdi">${esc(data.prosjektNr ?? "")}</div>
  </div>
  <div class="meta-celle">
    <div class="meta-etikett">Bygning</div>
    <div class="meta-verdi">${esc(data.bygningNavn ?? "")}</div>
  </div>
  <div class="meta-celle">
    <div class="meta-etikett">Opprettet av</div>
    <div class="meta-verdi">${esc(data.opprettetAv ?? "")}</div>
  </div>
  <div class="meta-celle">
    <div class="meta-etikett">Opprettet</div>
    <div class="meta-verdi">${esc(data.opprettetDatoTid ?? "")}</div>
  </div>
  <div class="meta-celle">
    <div class="meta-etikett">Endret av</div>
    <div class="meta-verdi">${esc(data.endretAv ?? "")}</div>
  </div>
  <div class="meta-celle">
    <div class="meta-etikett">Endret</div>
    <div class="meta-verdi">${esc(data.endretDatoTid ?? "")}</div>
  </div>
  <div class="meta-celle">
    <div class="meta-etikett">Status</div>
    <div class="meta-verdi"><span class="status-badge" style="${statusFarge}">${esc(statusTekst)}</span></div>
  </div>
</div>`;
}
