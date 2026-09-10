/**
 * Kollisjons-reset — delt avgjørelse for alle fire utfyllings-hooks (web + mobil,
 * sjekkliste + oppgave).
 *
 * Bakgrunn: feltvis kollisjons-deteksjon (`ae7725f9`) lot serveren beholde en
 * annens ferske verdi som «vinner» og lagre klientens tapende verdi som en
 * tilføyelse ved feltet. Etter en kollisjon skrev hooken vinneren (server-verdien)
 * tilbake i feltet — UBETINGET. Skrev brukeren i feltet mens lagringen var i luften,
 * ble tegnene hun akkurat skrev overskrevet av server-verdien: teksten forsvant
 * under fingrene (Kenneths egen observasjon på `BHO-004` 08.09 — han trodde feltet
 * var låst; cowork målte at det var denne resetten, ikke `beregnLaasteFelter`).
 *
 * Avgjørelsen (Kenneth-linje for hele kollisjonsrunden — «ingenting forsvinner»):
 * er feltet RE-DIRTY (brukeren har endret det etter at vi sendte), skal brukerens
 * tekst STÅ. Neste lagring gir en ny kollisjon som håndteres som alle andre, og
 * den tapende verdien er allerede bevart som tilføyelse server-side. Er feltet
 * IKKE re-dirty (brukeren ser ikke på feltet / har ikke rørt det siden sending),
 * vises server-vinneren — uendret fra opprinnelig design.
 *
 * Re-dirty måles ved å sammenligne feltets NÅVÆRENDE verdi mot den vi SENDTE
 * (`verdiErLik`, JSON-sammenligning — samme «endret?»-begrep som mobilens
 * dirty-diff). Dette signalet er identisk på web og mobil og er derfor ETT
 * sannhetsbegrep for alle fire hooks; `endredeRef` (kun web) unngås med vilje,
 * så web og mobil ikke divergerer.
 *
 * Merk (ansvarsdeling): denne funksjonen avgjør KUN hvilken VERDI feltet skal
 * vise. `basisRef` skal ALLTID avanseres til server-verdien av kalleren (basis =
 * det serveren faktisk har), ellers oppdages ikke neste kollisjon — det gir tapte
 * kollisjoner, som er verre enn tapt tekst. Basis-representasjonen er ulik på web
 * (rå verdi) og mobil (FeltVerdi-objekt), så den biten bor i hver hook.
 */

/**
 * Er to feltverdier like? JSON-sammenligning slik at arrays (repeater-rader),
 * objekter og primitiver alle håndteres med ETT begrep — samme som mobilens
 * eksisterende dirty-diff (`norm`). `null`/`undefined` normaliseres til `null`.
 */
export function verdiErLik(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/**
 * Gitt kollisjon: hvilken verdi skal feltet vise?
 *
 * @param naavaerende feltets verdi i state NÅ (kan ha endret seg under flight)
 * @param sendt       verdien vi sendte til server (basisen kollisjonen ble målt mot)
 * @param server      server-vinnerens verdi fra kollisjonsresponsen
 * @returns `verdi` = det feltet skal vise · `reDirty` = ble brukerens tekst beholdt?
 *
 * Re-dirty (`naavaerende` ≠ `sendt`) → behold `naavaerende` (brukerens tekst står).
 * Ellers → `server` (vinneren vises, opprinnelig design).
 */
export function løsKollisjonsVerdi(args: {
  naavaerende: unknown;
  sendt: unknown;
  server: unknown;
}): { verdi: unknown; reDirty: boolean } {
  const reDirty = !verdiErLik(args.naavaerende, args.sendt);
  return { verdi: reDirty ? args.naavaerende : args.server, reDirty };
}
