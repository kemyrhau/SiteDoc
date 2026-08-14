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
import type { TreObjekt, FeltVerdi, PdfConfig } from "../typer";

export function byggInnhold(
  objekter: TreObjekt[],
  data: Record<string, FeltVerdi>,
  config: PdfConfig,
): string {
  let html = "";
  for (const objekt of objekter) {
    if (objekt.type === "repeater") {
      // Arkiv-override: repeater som tabell (skannbart), ikke felt.ts' div-blokk.
      // Repeater eier sine egne barn (kolonner) → ingen videre rekursjon her.
      html += byggRepeaterTabell(objekt, data[objekt.id]?.verdi, objekt.label);
      continue;
    }
    html += renderFelt(objekt, data[objekt.id], config);
    // Nestede seksjoner: render barn etter overskriften.
    if (objekt.children && objekt.children.length > 0) {
      html += byggInnhold(objekt.children, data, config);
    }
  }
  return html;
}
