/**
 * Arkivmal — ramme-byggeklosser (RENT LAG, Stage 1). Hver funksjon returnerer
 * et HTML-fragment; sammenstilling (Stage 3) + container (Stage 4) plasserer dem.
 * Pikselnøyaktig mot mockupen (commit c4a62ab4).
 */

import { esc } from "../hjelpere";
import { STATUS_TEKST } from "../konstanter";
import { ARKIV_FARGER } from "./arkiv-css";
import type { LøsteInnstillinger } from "./innstillinger";
import type {
  ArkivFirma,
  ArkivDokumentMeta,
  ArkivProsjektblokk,
  StatusCelle,
  SistEndret,
} from "./typer";

/** Menneskevendt status-tekst (gjenbruker STATUS_TEKST — ingen ny statuslogikk). */
export function statusTekst(status: string): string {
  return STATUS_TEKST[status] ?? status;
}

/** Semantisk farge for en status (§ spec: godkjent/lukket grønn, avvist rød), ellers null. */
export function statusSemantiskFarge(status: string): string | null {
  if (status === "approved" || status === "completed" || status === "closed") return ARKIV_FARGER.gronn;
  if (status === "rejected") return ARKIV_FARGER.rod;
  return null;
}

/** Topptekst (side 1): logo (valgfri) + firmanavn/org.nr + dokumenttype/navn/nr. */
export function byggTopptekst(
  firma: ArkivFirma,
  meta: ArkivDokumentMeta,
  innst: LøsteInnstillinger,
): string {
  const logo =
    innst.logo && firma.logoDataUrl
      ? `<img src="${esc(firma.logoDataUrl)}" alt="Firmalogo" class="ark-logo">`
      : "";
  // Firmanavn + org.nr er sporbarhetsminimum — alltid med.
  return `
<div class="ark-topptekst">
  <div class="ark-tt-venstre">
    ${logo}
    <div>
      <div class="ark-firmanavn">${esc(firma.navn)}</div>
      ${firma.orgnr ? `<div class="ark-orgnr">Org.nr ${esc(firma.orgnr)}</div>` : ""}
    </div>
  </div>
  <div class="ark-tt-hoyre">
    <div class="ark-dok-type">${esc(meta.dokumenttype)}</div>
    <div class="ark-dok-navn">${esc(meta.dokumentnavn)}</div>
    <div class="ark-dok-nr">Dokumentnr. ${esc(meta.dokumentnummer)}</div>
  </div>
</div>`.trim();
}

/**
 * Prosjektblokk — Prosjekt / Byggeplass / Byggherre. Komprimeres: kun celler
 * som er slått på OG har verdi rendres (kolonner faller bort, ikke tomrom).
 * `prosjektnavn` styrer Prosjekt, `lokasjon` styrer Byggeplass; Byggherre alltid.
 */
export function byggProsjektblokk(
  blokk: ArkivProsjektblokk,
  innst: LøsteInnstillinger,
): string {
  const celler: string[] = [];
  const celle = (etikett: string, verdi: string) =>
    `<div><span class="ark-etikett">${esc(etikett)}</span><br><strong>${esc(verdi)}</strong></div>`;

  if (innst.prosjektnavn && blokk.prosjekt) celler.push(celle("Prosjekt", blokk.prosjekt));
  if (innst.lokasjon && blokk.byggeplass) celler.push(celle("Byggeplass", blokk.byggeplass));
  if (blokk.byggherre) celler.push(celle("Byggherre", blokk.byggherre));

  if (celler.length === 0) return "";
  return `<div class="ark-prosjektblokk">${celler.join("")}</div>`;
}

/** Én statusblokk-celle → HTML. */
function statusCelleHtml(c: StatusCelle): string {
  const fargeStil = c.farge ? ` style="color:${c.farge}"` : "";
  const under = c.underVerdi ? ` <span class="ark-etikett">${esc(c.underVerdi)}</span>` : "";
  return `<div class="ark-status-celle"><span class="ark-etikett">${esc(c.etikett)}</span><br><strong${fargeStil}>${esc(c.verdi)}</strong>${under}</div>`;
}

/**
 * Statusblokk. Varianten leverer sine celler; «Sist endret» legges til her når
 * `sistEndret` finnes (femte felt). Første celle (Status) settes med semantisk
 * farge av kalleren.
 */
export function byggStatusblokk(celler: StatusCelle[], sistEndret?: SistEndret | null, formaterDato?: (iso: string) => string): string {
  const alle = [...celler];
  if (sistEndret) {
    const dato = formaterDato ? formaterDato(sistEndret.dato) : sistEndret.dato;
    alle.push({ etikett: "Sist endret", verdi: sistEndret.navn, underVerdi: dato });
  }
  return `<div class="ark-statusblokk">${alle.map(statusCelleHtml).join("")}</div>`;
}

/**
 * Slank fortsettelses-header (side 2+). Brukes som Playwright headerTemplate i
 * containeren; her som ren HTML. Én linje firma · én linje dok-referanse.
 */
export function byggFortsettelsesHeader(
  firma: ArkivFirma,
  meta: ArkivDokumentMeta,
  prosjekt: string | null | undefined,
  innst: LøsteInnstillinger,
): string {
  const logo =
    innst.logo && firma.logoDataUrl
      ? `<img src="${esc(firma.logoDataUrl)}" alt="Firmalogo" class="ark-fs-logo">`
      : "";
  const orgnr = firma.orgnr ? ` <span class="ark-etikett" style="font-weight:400">· Org.nr ${esc(firma.orgnr)}</span>` : "";
  const dokRef = [
    `${esc(meta.dokumenttype)} — ${esc(meta.dokumentnavn)}`,
    `<strong style="color:${ARKIV_FARGER.tekst}">${esc(meta.dokumentnummer)}</strong>`,
    prosjekt ? esc(prosjekt) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return `
<div class="ark-fortsettelse">
  <div class="ark-fs-venstre">${logo}<div class="ark-fs-firma">${esc(firma.navn)}${orgnr}</div></div>
  <div class="ark-fs-hoyre">${dokRef}</div>
</div>`.trim();
}

/**
 * Bunntekst — «Generert fra SiteDoc {tid} · dokument-id {id}» (venstre) +
 * valgfritt sidetall (høyre; settes normalt av Playwright footerTemplate).
 * Generert-stempel + id er sporbarhetsminimum (§4) — alltid med.
 */
export function byggBunntekst(
  meta: ArkivDokumentMeta,
  generertTekst: string,
  sidetallHtml?: string | null,
): string {
  const hoyre = sidetallHtml ? `<span>${sidetallHtml}</span>` : "<span></span>";
  return `<div class="ark-footer"><span>Generert fra SiteDoc ${esc(generertTekst)} · dokument-id ${esc(meta.dokumentId)}</span>${hoyre}</div>`;
}
