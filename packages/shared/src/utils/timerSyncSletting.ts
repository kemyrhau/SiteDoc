/**
 * Server→klient delete-propagering for timer-synk (ORDRE 1a, 2026-08-20).
 *
 * Rotårsak: `hentEndringerSiden` er inkrementell (updatedAt) og returnerer kun
 * eksisterende sedler — en sedel slettet på SERVERSIDEN (rydding, server-splitt,
 * cleanup) forsvinner bare fra svaret, og mobilens pull har ingen kanal for å
 * fjerne den lokalt → spøkelse-sedler + doblet timetall.
 *
 * Fiks: serveren sender et AUTORITATIVT id-sett for et EKSPLISITT intervall
 * (`Slettevindu`). Denne rene funksjonen avgjør hvilke lokale sedler som skal
 * slettes, med to ufravikelige vakter:
 *
 *   Vakt 1 — kun sedler innenfor intervallet serveren uttalte seg om. En lokal
 *            sedel utenfor [fraDato, tilDato] røres ALDRI: serveren enumererte
 *            den ikke, så fraværet fra id-settet betyr ingenting for den. (Uten
 *            dette ville en klient med gamle lokale sedler fått dem slettet på et
 *            grunnlag serveren aldri uttalte seg om — `hentEndringerSiden` har to
 *            where-grener, updatedAt UTEN datogrense og dato ≥ minDato, så
 *            «vinduet» kan ikke utledes trygt på klientsiden.)
 *   Vakt 2 — lokalt arbeid med syncStatus "pending"/"avvist" røres ALDRI, selv
 *            om id-en mangler i settet: upushet offline-arbeid er ikke slettet på
 *            server, det finnes bare ikke DER ennå.
 *
 * Ren og uten avhengigheter — delt kilde slik at synk-koden (`timerSync.ts`) og
 * testen deler nøyaktig samme vakt-logikk.
 */

/**
 * Intervallet server-id-settet er autoritativt for. `YYYY-MM-DD`. `tilDato`
 * null = åpent oppover (serveren enumererte alt fra `fraDato` og framover).
 */
export interface Slettevindu {
  fraDato: string;
  tilDato: string | null;
}

/** Minimalt utsnitt av en lokal dagsseddel som trengs for slette-avgjørelsen. */
export interface LokalSedelUtsnitt {
  id: string;
  /** `YYYY-MM-DD` — sammenliknes leksikografisk mot vinduet (ISO-datoer). */
  dato: string;
  syncStatus: string;
}

/**
 * Returnerer id-ene til de lokale sedlene som skal slettes fordi serveren —
 * innenfor `vindu` — ikke lenger har dem.
 *
 * `levendeNokler` skal inneholde BÅDE server-`id` OG `clientUuid` for hver
 * levende sedel, siden en lokal `id` kan være enten (clientUuid-invarianten for
 * nyere data, eller server-id for data pullet før invarianten).
 */
export function finnSedlerÅSlette(
  lokale: readonly LokalSedelUtsnitt[],
  levendeNokler: ReadonlySet<string>,
  vindu: Slettevindu,
): string[] {
  const slett: string[] = [];
  for (const s of lokale) {
    // Vakt 1: kun innenfor det serveren uttalte seg om.
    if (s.dato < vindu.fraDato) continue;
    if (vindu.tilDato !== null && s.dato > vindu.tilDato) continue;
    // Vakt 2: aldri upushet lokalt arbeid.
    if (s.syncStatus === "pending" || s.syncStatus === "avvist") continue;
    // Finnes fortsatt på server (via id ELLER clientUuid)?
    if (levendeNokler.has(s.id)) continue;
    slett.push(s.id);
  }
  return slett;
}
