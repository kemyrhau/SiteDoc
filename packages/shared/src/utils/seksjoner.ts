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
