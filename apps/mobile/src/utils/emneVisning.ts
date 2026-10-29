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

/**
 * Hvordan redigeringen av emnet avsluttes (telefonfunn 2026-10-29: emnet ble bare lagret
 * med den lille «Lagre»-knappen — retur på tastaturet og å forlate feltet mistet teksten).
 * Web lagrer på Enter (`EmneVelger`).
 */
export type EmneAvslutning = "lagre" | "retur" | "forlat" | "avbryt";

export type EmneLagring = { lagre: false } | { lagre: true; verdi: string | null };

/**
 * Skal utkastet lagres? Lagrer bare når den rensede verdien avviker fra lagret `emne`
 * (ingen dobbeltlagring når retur og blur fyrer etter hverandre, ingen mutasjon når
 * ingenting er endret). «Avbryt» lagrer aldri. Tomt utkast = fjern emnet (`null`).
 */
export function emneLagring(
  avslutning: EmneAvslutning,
  utkast: string,
  emne: string | null,
): EmneLagring {
  if (avslutning === "avbryt") return { lagre: false };
  const verdi = utkast.trim() === "" ? null : utkast.trim();
  const lagret = emne?.trim() ? emne.trim() : null;
  return verdi === lagret ? { lagre: false } : { lagre: true, verdi };
}
