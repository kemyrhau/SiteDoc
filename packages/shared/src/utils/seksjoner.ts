/**
 * Kollapsbare heading-seksjoner i utfylling — delt gruppering for web + mobil.
 *
 * Bakgrunn (fase M-3a del 2, pkt 2): sjekkliste-/oppgave-utfylling rendret en
 * flat sekvens av rapportobjekter. En `heading` var bare et selvstendig element
 * i rekka. Seksjonering kan utledes RENT fra rekkefølge + `type === "heading"`
 * UTEN datamodell-endring (målt 2026-07-16): hvert rot-nivå heading starter en
 * seksjon som omslutter alle påfølgende felter til neste rot-heading.
 *
 * Kritisk: kun ROT-headings (uten `parentId`) er seksjonsgrenser. En nestet/
 * betinget heading (har `parentId`) forblir et inline-felt i sin seksjon, så
 * eksisterende parentId-nesting (repeater, betingelse) bevares uendret.
 */

import { IKKE_UTFYLLBARE_FELTTYPER } from "./feltLaasing";

export interface Seksjon<T> {
  /** Heading-objektet som titulerer seksjonen, eller null for ledende felter
   *  (topptekst / felter før første heading) som vises ugruppert. */
  overskrift: T | null;
  /** Feltene i seksjonen, i original rekkefølge — uten selve heading-objektet. */
  felter: T[];
}

/**
 * Grupper en flat, ferdig-sortert objektliste i seksjoner per rot-heading.
 * Objekter før første heading (inkl. topptekst) havner i en ledende seksjon
 * med `overskrift: null`.
 */
export function grupperMedOverskrift<
  T extends { type: string; parentId?: string | null },
>(objekter: T[]): Seksjon<T>[] {
  const seksjoner: Seksjon<T>[] = [];
  let gjeldende: Seksjon<T> = { overskrift: null, felter: [] };

  for (const obj of objekter) {
    const erRotOverskrift = obj.type === "heading" && !obj.parentId;
    if (erRotOverskrift) {
      seksjoner.push(gjeldende);
      gjeldende = { overskrift: obj, felter: [] };
    } else {
      gjeldende.felter.push(obj);
    }
  }
  seksjoner.push(gjeldende);

  return seksjoner.filter((s) => s.overskrift !== null || s.felter.length > 0);
}

/**
 * Felttyper som IKKE er kontrollpunkt og derfor ikke telles i seksjonsstatusen.
 *
 * Superset av `IKKE_UTFYLLBARE_FELTTYPER` (append-only/P2-guarden): den delte lista
 * dekker `heading/subtitle/location/drawing_position/calculation`, men rendrerne la til
 * de rene instruksjons-/visnings-typene `info_text`/`info_image`/`video` (F2-rest
 * 2026-08-23) UTEN å backporte dem hit, selv om `feltLaasing`-kommentaren sier lista skal
 * speile «RapportObjektRenderer DISPLAY/SKJULT/READONLY». En seksjon med kun lesetekst
 * ville ellers vist «0 av 1 ⚠» permanent. Vi utvider derfor LOKALT for telleren og rører
 * ikke basislista (P2-guarden er urørt). Drift flagget til fabel — når basislista
 * konsolideres kollapser dette settet til å være likt den.
 */
export const IKKE_TELLBARE_FELTTYPER: ReadonlySet<string> = new Set([
  ...IKKE_UTFYLLBARE_FELTTYPER,
  "info_text",
  "info_image",
  "video",
]);

/** Utfyllingsgrad for én seksjon — `totalt === 0` betyr «ingen kontrollpunkt» (ingen badge). */
export interface SeksjonUtfylling {
  /** Antall tellbare, synlige felt med en reell verdi. */
  utfylt: number;
  /** Antall tellbare, synlige felt (nevneren). Betinget skjulte felt teller ikke. */
  totalt: number;
  /** Avledet tilstand: `tom` = ingen kontrollpunkt · `urort`/`delvis`/`komplett`. */
  tilstand: "tom" | "urort" | "delvis" | "komplett";
}

/**
 * Tell utfyllingsgrad for en seksjons felter — delt kilde så web og mobil teller identisk.
 *
 * - **Nevner (`totalt`):** tellbare felttyper (`IKKE_TELLBARE_FELTTYPER` ekskludert) som er
 *   synlige. Betinget skjulte felt (`erSynlig === false`) og repeater-barn telles ikke —
 *   kalleren signaliserer sistnevnte ved å returnere `null`.
 * - **Teller (`utfylt`):** de av nevnerens felt som har en reell verdi (`harVerdi`). Kun
 *   feltVERDI — kommentar/vedlegg/oppgave er tilbehør og teller IKKE (fabel-lås 05.09).
 *
 * @param felter    seksjonens felter (`grupperMedOverskrift(...).felter`), rå malobjekter.
 * @param feltStatus per-felt-oppslag fra siden (`erSynlig` + `harFeltVerdi(hentFeltVerdi(id).verdi)`).
 *                   Returner `null` for felt som ikke skal telles i det hele tatt (repeater-barn).
 */
export function beregnSeksjonUtfylling<T extends { type: string }>(
  felter: readonly T[],
  feltStatus: (objekt: T) => { synlig: boolean; harVerdi: boolean } | null,
): SeksjonUtfylling {
  let utfylt = 0;
  let totalt = 0;
  for (const felt of felter) {
    if (IKKE_TELLBARE_FELTTYPER.has(felt.type)) continue;
    const status = feltStatus(felt);
    if (!status || !status.synlig) continue;
    totalt += 1;
    if (status.harVerdi) utfylt += 1;
  }
  const tilstand =
    totalt === 0
      ? "tom"
      : utfylt === 0
        ? "urort"
        : utfylt === totalt
          ? "komplett"
          : "delvis";
  return { utfylt, totalt, tilstand };
}
