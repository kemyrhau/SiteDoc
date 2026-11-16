/**
 * Arkivmal — innholds-renderer (Stage 2). Rendrer rapportobjekt-treet for
 * checklist/oppgave/hms-varianter ved å gjenbruke `renderFelt` (felt.ts), men
 * tre-bevisst: rekurserer inn i nestede seksjoner slik at felt under en
 * overskrift ikke faller ut. Seksjonsoverskrifter (heading/subtitle) rendres
 * alltid av felt.ts — også når alle barn er tomme.
 *
 * `config.visTommeStrukturer` settes av arkiv-sammenstillingen (Stage 3) → tom
 * repeater/attachments vises som «Ingen rader registrert»/«Ingen vedlegg» i
 * stedet for å skjules stille.
 */

import { renderFelt } from "../felt";
import { byggRepeaterTabell } from "./repeater";
import { byggRadkort, repeaterErRik } from "./radkort";
import { byggOppgaveHenvisning } from "../hjelpere";
import { nyBildeTeller, samleBildeNr } from "../hjelpere";
import type { BildeTeller } from "../hjelpere";
import type { TreObjekt, FeltVerdi, PdfConfig } from "../typer";

/**
 * `teller` = dokumentets løpende bildenummer (ordre 2026-11-04 (2)): ÉN teller for hele
 * dokumentet, tråd gjennom felt, nestede seksjoner og repeatere i render-rekkefølge.
 * Toppkallet lager den med alle lagrede `bildeNr` i `data` som reserverte (RETUR 1);
 * rekursjonen sender samme instans videre.
 */
export function byggInnhold(
  objekter: TreObjekt[],
  data: Record<string, FeltVerdi>,
  config: PdfConfig,
  teller: BildeTeller = nyBildeTeller(samleBildeNr(data)),
): string {
  let html = "";
  for (const objekt of objekter) {
    if (objekt.type === "repeater") {
      // Formvalg (Kenneth-vedtak 2026-08-21): RIK repeater (bilder/tegningsposisjon/
      // nestet repeater) → radkort (mockup 2a); helskalar → tabell (mockup 2b).
      // Aldri blandingsformer. Repeater eier barna → ingen videre rekursjon her.
      // F7: send hele FeltVerdi (ikke bare .verdi) så objektnivå-kommentar/vedlegg
      // (festet på repeateren uten «Legg til rad») kan rendres i «Registrert utenfor rader».
      html += repeaterErRik(objekt)
        ? byggRadkort(objekt, data[objekt.id]?.verdi, objekt.label, data[objekt.id], teller, config)
        : byggRepeaterTabell(objekt, data[objekt.id]?.verdi, objekt.label, data[objekt.id], teller, config);
      // PDF-1: oppgaver festet på repeateren selv (ikke en rad) — under hele repeateren.
      html += byggOppgaveHenvisning(objekt.id, config);
      continue;
    }
    // D2 (tegningsutsnitt) + D3 (instruksjonstyper) er FOLDET inn i renderFelt (2026-08-24) —
    // felt.ts-frysen ble opphevet, så intercept-i-innhold.ts trengs ikke lenger.
    html += renderFelt(objekt, data[objekt.id], config, teller);
    // PDF-1: «Oppgaver: …» under feltet som har oppgaver (alltid, uavhengig av utskriftsvalg).
    html += byggOppgaveHenvisning(objekt.id, config);
    // Nestede seksjoner: render barn etter overskriften.
    if (objekt.children && objekt.children.length > 0) {
      html += byggInnhold(objekt.children, data, config, teller);
    }
  }
  return html;
}
