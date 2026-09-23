/**
 * Kollapsbare seksjoner i utfylling — delt gruppering for web + mobil.
 *
 * Bakgrunn (fase M-3a del 2, pkt 2): sjekkliste-/oppgave-utfylling rendret en
 * flat sekvens av rapportobjekter. En `heading` var bare et selvstendig element
 * i rekka. Seksjonering kan utledes RENT fra rekkefølge + felttype UTEN
 * datamodell-endring (målt 2026-07-16): hvert rot-nivå heading/undertittel
 * starter en seksjon som omslutter alle påfølgende felter til neste grense.
 *
 * SEKSJONSGRENSE = rot-`heading` ELLER rot-`subtitle` (runde 91). Formen er FLAT
 * og på ETT nivå — begge typer lukker forrige seksjon og starter sin egen. En
 * ekte to-nivå-nøsting (undertittel som barn av overskrift) ble bevisst valgt
 * bort: den ville brutt den flate `Seksjon<T>`-kontrakten, den id-nøklede
 * kollaps-tilstanden og `beregnSeksjonUtfylling` (som teller per seksjon, ikke
 * per tre). Flat form er bakoverkompatibel: alle kallere (web + mobil + PSI-
 * forhåndsvisningen) itererer `Seksjon<T>[]` uendret; kun undertitler blir nå
 * egne foldbare seksjoner der de før lå inline.
 *
 * Kritisk: kun ROT-objekter (uten `parentId`) er seksjonsgrenser. En nestet/
 * betinget heading/undertittel (har `parentId`) forblir et inline-felt i sin
 * seksjon, så eksisterende parentId-nesting (repeater, betingelse) bevares.
 */

import { IKKE_UTFYLLBARE_FELTTYPER } from "./feltLaasing";

/** Felttyper som er seksjonsgrenser på rot-nivå (heading + undertittel). */
export const SEKSJONSGRENSE_TYPER: ReadonlySet<string> = new Set(["heading", "subtitle"]);

export interface Seksjon<T> {
  /** Grense-objektet som titulerer seksjonen (heading el. subtitle), eller null
   *  for ledende felter (topptekst / felter før første grense) som vises ugruppert. */
  overskrift: T | null;
  /** Feltene i seksjonen, i original rekkefølge — uten selve grense-objektet. */
  felter: T[];
}

/**
 * Grupper en flat, ferdig-sortert objektliste i seksjoner per rot-grense
 * (heading ELLER subtitle). Objekter før første grense (inkl. topptekst) havner
 * i en ledende seksjon med `overskrift: null`.
 */
export function grupperMedOverskrift<
  T extends { type: string; parentId?: string | null },
>(objekter: T[]): Seksjon<T>[] {
  const seksjoner: Seksjon<T>[] = [];
  let gjeldende: Seksjon<T> = { overskrift: null, felter: [] };

  for (const obj of objekter) {
    const erRotGrense = SEKSJONSGRENSE_TYPER.has(obj.type) && !obj.parentId;
    if (erRotGrense) {
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
 * Kan en seksjon foldes? Styres av grense-objektets `config.kanSlasSammen`
 * (Krav 2, runde 91). STANDARD ER PÅ: mangler feltet i `config` (eller er ikke
 * eksplisitt `false`), er seksjonen foldbar. Folding fantes på HVER overskrift
 * før flagget — et flagg som fødtes tomt ville slått den av på alle eksisterende
 * maler, derfor leses fravær som `true` i stedet for datamigrering
 * (SAMARBEIDSREGLER § «stille tomhet» krav (a), løst ved standardverdi).
 */
export function kanSlasSammen(config: unknown): boolean {
  return !(
    typeof config === "object" &&
    config !== null &&
    (config as Record<string, unknown>).kanSlasSammen === false
  );
}

/** Avledet utfyllingstilstand for én seksjon (fra `beregnSeksjonUtfylling`). */
export type SeksjonTilstand = SeksjonUtfylling["tilstand"];

/**
 * Auto-kollaps ved fullført seksjon (Krav 1, runde 91) — REN reduksjon, delt
 * kilde så web og mobil oppfører seg identisk. Komponenten holder tilstanden
 * (forrige tilstand i en ref, `kollapsede` i state) og kaller denne på hver
 * endring. Kantutløst på OVERGANG, ikke på verdi:
 *
 *  - En seksjon som går OVER TIL `komplett` foldes — men bare i det ene
 *    rendret der overgangen skjer. Åpner brukeren den igjen, står den åpen
 *    (neste render har `forrige === komplett`, ingen overgang → uendret). Slik
 *    slåss ikke funksjonen mot fingrene.
 *  - En seksjon som går FRA `komplett` til noe annet (et felt ble tømt eller
 *    skjult) åpnes igjen — en seksjon som mangler data skal aldri være skjult.
 *  - `tom` (`totalt === 0`, ingen kontrollpunkt) folder ALDRI: en overgang til
 *    `komplett` er umulig derfra, og en ren informasjonsseksjon skal ikke
 *    skjule seg selv.
 *  - Ikke-foldbare seksjoner (`kanFoldes === false`) holdes alltid åpne.
 *  - Første måling (`forrige` mangler) folder ingenting: auto-kollaps er en
 *    reaksjon på at brukeren FYLLER ut, ikke på at et ferdig dokument lastes.
 */
export function nesteKollapsTilstand(
  naa: ReadonlyArray<{ id: string; tilstand: SeksjonTilstand; kanFoldes: boolean }>,
  forrige: ReadonlyMap<string, SeksjonTilstand>,
  kollapsede: ReadonlySet<string>,
): Set<string> {
  const neste = new Set(kollapsede);
  for (const s of naa) {
    if (!s.kanFoldes) {
      neste.delete(s.id);
      continue;
    }
    const før = forrige.get(s.id);
    if (før === undefined || før === s.tilstand) continue;
    if (s.tilstand === "komplett") neste.add(s.id);
    else if (før === "komplett") neste.delete(s.id);
  }
  return neste;
}

/**
 * Felttyper som IKKE er kontrollpunkt og derfor ikke telles i seksjonsstatusen.
 *
 * KONSOLIDERT 2026-09-06: `info_text`/`info_image`/`video` lå tidligere som et lokalt
 * superset her fordi de manglet i basislista (`IKKE_UTFYLLBARE_FELTTYPER`). Nå er de
 * flyttet inn i basislista, så settet er identisk med den — akkurat den kollapsen den
 * gamle kommentaren forutså. Beholdt som eget navn for teller-call-sites; skulle telleren
 * en dag måtte ekskludere et FAKTISK svar-felt (som basislista ikke kan røre uten å endre
 * P2-guarden), utvides det her igjen.
 */
export const IKKE_TELLBARE_FELTTYPER: ReadonlySet<string> = IKKE_UTFYLLBARE_FELTTYPER;

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
