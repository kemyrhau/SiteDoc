/**
 * Arkivmal — signaturblokk (Stage 3). Nederst, ETTER logg (signaturen bekrefter
 * alt foran seg). Reelle signaturdata gjengis (håndskrift-navn i Caveat over
 * strek); mangler signatur → åpen strek. Under streken: rolle-etikett + navn
 * (+ rolle) + «{verb} i SiteDoc {dato} {tid}». Sporbarhetsminimum — kan ikke
 * velges bort.
 */

import { esc, formaterDatoTid } from "../hjelpere";
import type { ArkivSignatur } from "./typer";

function signaturfelt(s: ArkivSignatur): string {
  const verb = s.verb ?? "signert";
  const rolle = s.rolle ? `, ${esc(s.rolle)}` : "";
  const navnOverStrek = s.tidspunkt
    ? `<div class="ark-sign-navn">${esc(s.navn)}</div>`
    : `<div class="ark-sign-navn ark-sign-tom">&nbsp;</div>`;
  const kvittering = s.tidspunkt
    ? `${esc(s.rolleEtikett)} — ${esc(s.navn)}${rolle} · ${verb} i SiteDoc ${esc(formaterDatoTid(s.tidspunkt))}`
    : `${esc(s.rolleEtikett)} — ikke ${verb}`;
  return `<div class="ark-sign-felt">${navnOverStrek}<div class="ark-sign-strek">${kvittering}</div></div>`;
}

export function byggSignaturblokk(signaturer: ArkivSignatur[]): string {
  if (signaturer.length === 0) return "";
  return `<div class="ark-signatur">${signaturer.map(signaturfelt).join("")}</div>`;
}
