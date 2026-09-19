/**
 * Ren beslutning bak mobil-`KnappMedForklaring`: hvilken tekst (om noen) skal stå
 * under en sperret knapp. Skilt ut i egen `.ts` slik at mobil-harnessen (node-env,
 * `src/**\/*.test.ts`, ingen RN-render) kan teste regelen uten å rendre komponenten
 * — samme mønster som `utledFlytbytteVisning`.
 *
 * Regelen: forklaringen vises BARE når knappen er sperret pga. manglende input.
 * Er den ikke sperret (aktiv, eller sperret av en mutasjon som kjører), er det
 * ingen linje — da er spinneren signalet.
 */
export function forklaringSomVises(sperret: boolean, forklaring: string): string | null {
  return sperret ? forklaring : null;
}
