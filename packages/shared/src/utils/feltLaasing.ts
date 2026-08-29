/**
 * Append-only felt-låsing — delt kilde for OPPGAVE-hookene (web + mobil).
 *
 * Scope (vedtatt 2026-07-16): append-only gjelder KUN oppgave. Spec
 * (`dokumentflyt.md § 2`): oppgave = «Aldri redigerbar — append-only fra
 * opprettelse»; sjekkliste = «Redigerbar — den som har ballen + admin/registrator
 * alltid». `04f6d295` slo på låsen for alle fire hooks; det var riktig for
 * oppgave (mobil manglet den) men feil for sjekkliste (låste innsendte felt
 * permanent, også for admin). Sjekkliste-hookene bruker den derfor IKKE lenger.
 *
 * Bakgrunn: append-only redigering («felt med eksisterende verdi er låst, nye
 * felt kan fylles ut») ble opprinnelig bygget kun i web `useOppgaveSkjema`
 * (commit eb984d91). For å unngå kopi bor predikatet + lås-utledningen her, og
 * begge oppgave-hookene importerer den.
 *
 * VIKTIG (mobil): lås-settet skal ALLTID beregnes fra server-bekreftet data
 * (`Task.data` fra query), ALDRI fra lokal usynkronisert SQLite-verdi. Ellers
 * låses et felt brukeren nettopp fylte offline og ikke har sendt.
 *
 * Merk: dette er en klient-lås (UI-håndhevelse). Server `oppdaterData` gjør i
 * dag shallow merge og håndhever IKKE append-only — se flytRolle.ts.
 */

/**
 * Har feltet en reell (ikke-tom) verdi? Tom streng, null/undefined, tom array
 * OG tomt objekt (`{}`) regnes som «ingen verdi» og låser derfor ikke. Samme
 * tom-definisjon som serverens append-only-vakt (`oppgave.oppdaterData`) bruker,
 * så klient-lås og server-håndhevelse ikke divergerer på hva «tomt» betyr.
 */
export function harFeltVerdi(verdi: unknown): boolean {
  return (
    verdi !== null &&
    verdi !== undefined &&
    verdi !== "" &&
    !(Array.isArray(verdi) && verdi.length === 0) &&
    !(
      typeof verdi === "object" &&
      !Array.isArray(verdi) &&
      Object.keys(verdi as object).length === 0
    )
  );
}

/**
 * Felttyper som IKKE er bruker-utfyllbare svar: ren visning (`heading`/`subtitle`),
 * skjult i utfylling (`location`/`drawing_position`) og auto-utledet (`calculation`).
 * Delt kilde med web-rendreren (`RapportObjektRenderer` DISPLAY/SKJULT/READONLY) og
 * P2-guarden (tom-besvarelse) så «hva er et svar-felt» ikke divergerer.
 */
export const IKKE_UTFYLLBARE_FELTTYPER: ReadonlySet<string> = new Set([
  "heading",
  "subtitle",
  "location",
  "drawing_position",
  "calculation",
]);

/** Er felttypen et bruker-utfyllbart svar-felt (ikke visning/skjult/auto-utledet)? */
export function erUtfyllbartFelt(type: string): boolean {
  return !IKKE_UTFYLLBARE_FELTTYPER.has(type);
}

/** Ett lagret svar slik det ligger i `Checklist.data`/`Task.data`. */
interface Besvarelsesfelt {
  verdi?: unknown;
  kommentar?: unknown;
  vedlegg?: unknown;
}

/**
 * Er feltet besvart? P2 (Kenneth-vedtak 2026-07-21, valg B): et svar teller hvis
 * brukeren har gitt ÉN av tre — `verdi`, `kommentar` eller `vedlegg`. Fanger foto-/
 * kommentar-svar uten verdi (feltarbeiderens vanligste flyt), ikke bare `verdi`.
 */
export function feltErBesvart(felt: Besvarelsesfelt | undefined | null): boolean {
  if (!felt) return false;
  return (
    harFeltVerdi(felt.verdi) ||
    harFeltVerdi(felt.kommentar) ||
    (Array.isArray(felt.vedlegg) && felt.vedlegg.length > 0)
  );
}

/**
 * Har en besvarelse minst ett utfylt svar-felt? Tom-besvarelse-guarden (P2): en
 * utfylling/besvarelse (→`responded`) kan aldri sendes tom.
 *
 * @param felter malens objekter (`id` + `type`). Display/skjulte/auto-felt filtreres bort.
 * @param data   svarene (`Checklist.data`/`Task.data`).
 * @returns true når malen ikke har utfyllbare felt (ingenting å fylle → ikke «tom»),
 *          ellers true bare hvis minst ett utfyllbart felt er besvart.
 */
export function harMinstEttUtfyltFelt(
  felter: ReadonlyArray<{ id: string; type: string }>,
  data: Record<string, Besvarelsesfelt | undefined> | null | undefined,
): boolean {
  // Malen brukes kun til å avgjøre OM det finnes noe å fylle. Selve «har svart»-
  // sjekken går mot `data` (enhver registrert svar-oppføring) — robust mot nestede
  // felt/repeater-nøkler som ikke nødvendigvis matcher et topp-nivå objekt-id.
  const harUtfyllbare = felter.some((f) => erUtfyllbartFelt(f.type));
  if (!harUtfyllbare) return true;
  if (!data) return false;
  return Object.values(data).some(feltErBesvart);
}

/** Ett lagret felt slik det ligger i `Checklist.data`/`Task.data`. */
interface LagretFelt {
  verdi?: unknown;
}

/**
 * Beregn settet av objekt-IDer som er låst for verdi-endring (append-only):
 * felt som allerede har en server-bekreftet, ikke-tom verdi. Kommentar og
 * vedlegg låses ikke og skal håndteres separat i hooken.
 */
export function beregnLaasteFelter(
  serverData: Record<string, LagretFelt | undefined> | null | undefined,
): Set<string> {
  const laaste = new Set<string>();
  if (!serverData) return laaste;
  for (const [objektId, felt] of Object.entries(serverData)) {
    if (felt && harFeltVerdi(felt.verdi)) laaste.add(objektId);
  }
  return laaste;
}
