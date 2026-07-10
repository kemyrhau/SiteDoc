/**
 * Tidsrom-validering for timer-rader — fra/til-rekkefølge + overlapp.
 *
 * Én arbeider kan ikke være to steder samtidig: to timer-rader på samme
 * dagsseddel med begge tider satt kan ikke overlappe (strengt), på tvers av
 * prosjekt og underprosjekt/ECO. Berøring i endepunkt (12:00 slutt = 12:00
 * start) teller IKKE som overlapp.
 *
 * Ren, uten avhengigheter — én sannhetskilde delt av web-mutasjonene
 * (`sjekkTimerOverlapp`/`refineFraForTil` i `apps/api`) og mobilens offline-
 * synk (`syncBatch` batch-intern kontroll, SYNC-2). Løftet hit for å hindre
 * at synkveien omgår regelen (jf. BACKLOG SYNC-2). Speiler `pauseBeregning.ts`.
 */

import { hhmmTilMin } from "./pauseBeregning";

/** Tidsrom med HH:MM-tider — én eller begge kan mangle. */
export interface Tidsrom {
  fraTid?: string | null;
  tilTid?: string | null;
}

/**
 * Gyldig når til-tid er strengt etter fra-tid. Mangler en av tidene finnes
 * ingen validering å gjøre → gyldig (`true`).
 */
export function tilErEtterFra(
  fra?: string | null,
  til?: string | null,
): boolean {
  if (!fra || !til) return true;
  return hhmmTilMin(til) > hhmmTilMin(fra);
}

/**
 * To tidsrom overlapper strengt. Berøring i endepunkt (a.til = b.fra) teller
 * IKKE som overlapp. Alle fire tidene må være satt av kalleren.
 */
export function tidsromOverlapper(
  aFra: string,
  aTil: string,
  bFra: string,
  bTil: string,
): boolean {
  const aF = hhmmTilMin(aFra);
  const aT = hhmmTilMin(aTil);
  const bF = hhmmTilMin(bFra);
  const bT = hhmmTilMin(bTil);
  return aF < bT && aT > bF;
}

/**
 * Finn første tidsrom i `andre` som overlapper (`fra`, `til`). Rader uten
 * begge tider hoppes over. Returnerer den overlappende raden, ellers `null`.
 * Brukes av web-vakten (ny/redigert rad mot eksisterende rader i basen).
 */
export function finnOverlappendeTidsrom<T extends Tidsrom>(
  fra: string | null | undefined,
  til: string | null | undefined,
  andre: readonly T[],
): T | null {
  if (!fra || !til) return null;
  for (const r of andre) {
    if (!r.fraTid || !r.tilTid) continue;
    if (tidsromOverlapper(fra, til, r.fraTid, r.tilTid)) return r;
  }
  return null;
}

/** Konflikt funnet i en samling tidsrom. */
export type TidsromKonflikt<T extends Tidsrom = Tidsrom> =
  | { type: "fra_etter_til"; rad: T }
  | { type: "overlapp"; rad: T; annen: T };

/**
 * Valider en hel samling tidsrom (typisk alle timer-radene på én dagsseddel):
 * hver rad må ha til > fra, og ingen to rader med begge tider satt kan
 * overlappe. Returnerer den første konflikten eller `null` hvis alt er gyldig.
 *
 * Brukes av `syncBatch` (SYNC-2): en offline-økt sender hele dagen i én
 * `createMany`, så overlapp må sjekkes INNAD i settet — ingen av radene finnes
 * i basen ennå.
 */
export function finnTidsromKonflikt<T extends Tidsrom>(
  rader: readonly T[],
): TidsromKonflikt<T> | null {
  for (const rad of rader) {
    if (!tilErEtterFra(rad.fraTid, rad.tilTid)) {
      return { type: "fra_etter_til", rad };
    }
  }
  for (let i = 0; i < rader.length; i++) {
    const rad = rader[i];
    if (!rad || !rad.fraTid || !rad.tilTid) continue;
    const annen = finnOverlappendeTidsrom(
      rad.fraTid,
      rad.tilTid,
      rader.slice(i + 1),
    );
    if (annen) return { type: "overlapp", rad, annen };
  }
  return null;
}
