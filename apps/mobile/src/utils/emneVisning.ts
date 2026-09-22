/**
 * Emne-feltets visningstilstand på mobil-detaljskjermen (sjekkliste/oppgave).
 *
 * Bakgrunn (ordre opprett-uten-modal 2026-09-22, Kenneth-vedtak 2026-08-29): emne er en
 * merkelapp for gjenfinning — ikke dokumentasjon — og skal kunne settes/rettes ETTER at
 * dokumentet er opprettet. I dag finnes emne kun i mobilens opprett-modal, så det er
 * usynlig der folk faktisk fyller ut. Emnet flyttes derfor inn i dokumentet, synlig
 * øverst OGSÅ når det er tomt: som «legg til»-felt for den som kan redigere, og som
 * «Ingen emne»-tilstand (med etikett) i lesemodus for andre.
 *
 * Ren funksjon (mobil-vitest kjører kun ren TS) — RN-komponenten `EmneFelt` rendrer ut
 * fra denne, slik web-`EmneVelger` gjør med sine tilstander. `leseModus` bæres av
 * kalleren (server-vakten i `sjekkliste.oppdater`/`oppgave.oppdater` er sannheten;
 * denne styrer kun VISNING, ikke tilgang).
 */
export type EmneVisning =
  | { modus: "utfylt"; tekst: string; kanRedigere: boolean }
  | { modus: "tomt-redigerbar" }
  | { modus: "tomt-lesemodus" };

export function emneVisning(emne: string | null, leseModus: boolean): EmneVisning {
  const rent = (emne ?? "").trim();
  if (rent !== "") {
    return { modus: "utfylt", tekst: rent, kanRedigere: !leseModus };
  }
  return leseModus ? { modus: "tomt-lesemodus" } : { modus: "tomt-redigerbar" };
}
