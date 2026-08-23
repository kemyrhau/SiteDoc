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
import { byggArkivTegningsposisjon } from "./tegningsfelt";
import { byggInstruksjonsfelt } from "./instruksjonsfelt";
import type { TreObjekt, FeltVerdi, PdfConfig } from "../typer";

export function byggInnhold(
  objekter: TreObjekt[],
  data: Record<string, FeltVerdi>,
  config: PdfConfig,
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
        ? byggRadkort(objekt, data[objekt.id]?.verdi, objekt.label, data[objekt.id])
        : byggRepeaterTabell(objekt, data[objekt.id]?.verdi, objekt.label, data[objekt.id]);
      continue;
    }
    if (objekt.type === "drawing_position") {
      // Arkiv-override (D2): tegningsutsnitt via byggTegningPosisjon — felt.ts
      // utelater denne (frosset mobil-sti). Ingen markør/bilde → "".
      html += byggArkivTegningsposisjon(data[objekt.id]?.verdi, config.tegningsOppslag);
      continue;
    }
    // Arkiv-override (F2-rest): info_text/info_image/video/quiz — felt.ts dropper
    // alle fire (frosset). Quiz-svaret er dokumentasjonsdata (datatap før).
    const instruksjon = byggInstruksjonsfelt(objekt, data[objekt.id]);
    if (instruksjon !== null) {
      html += instruksjon;
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
