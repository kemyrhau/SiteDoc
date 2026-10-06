import { TRPCError } from "@trpc/server";

/**
 * LAG 0a (H5) — ÉN kilde for maks-taket på en `sheetTimer.timer`-verdi.
 *
 * Zod kan ikke kjenne lønnsarten, så taket MÅ legges i handleren etter at
 * lønnsarten er lastet. Dette er den eneste kilden alle skrivestiene (interaktiv
 * web, forsoning, firma-admin-redigering og mobil `syncBatch`) leser fra — to
 * kopier av tallet ville vært den femte kopien denne uken.
 *
 * Reparasjon (ikke funksjonsendring): valideringen var alltid ment å gjelde
 * timer. En kjøregodtgjørelse føres på en lønnsart med `satsEnhet="per_km"`, og
 * et 24-tak avviste selv 60 km. `satsEnhet` leses KUN som avlesning av hva raden
 * er — ingen km-felt, ingen datamodell-endring, `sats` ganges ikke med noe.
 * K4 (skal km bli en målt størrelse?) står fortsatt åpen i helhetsplanen.
 */

/** Maks timer på én dag for en ordinær (time-/dag-basert) lønnsart. */
export const TIMER_MAKS_PER_DAG = 24;

/**
 * Maks km på én dag for en `per_km`-lønnsart (kjøregodtgjørelse).
 *
 * 2000 ligger godt over enhver fysisk mulig dagsdistanse i Norge (en lang skift
 * på ~11 t i høy hastighet ≈ ~1000 km), så ekte kjøregodtgjørelse blokkeres
 * aldri — samtidig som en tastefeil i størrelsesorden (f.eks. 20000) fanges.
 * Dette er en grov fornuftssperre, ikke en presis grense.
 */
export const KM_MAKS_PER_DAG = 2000;

/** Taket for en `sheetTimer.timer`-verdi gitt lønnsartens `satsEnhet`. */
export function maksForSatsEnhet(satsEnhet: string | null | undefined): number {
  return satsEnhet === "per_km" ? KM_MAKS_PER_DAG : TIMER_MAKS_PER_DAG;
}

/** Enhetsord til feilmeldingen — «km» for per_km, ellers «timer». */
function enhetsord(satsEnhet: string | null | undefined): string {
  return satsEnhet === "per_km" ? "km" : "timer";
}

/** Human-lesbar avvisningsmelding (delt av kast-stiene og `syncBatch`-avvis). */
export function takFeilmelding(
  verdi: number,
  satsEnhet: string | null | undefined,
): string {
  return `Verdien ${verdi} overstiger maksgrensen på ${maksForSatsEnhet(
    satsEnhet,
  )} ${enhetsord(satsEnhet)} for én dag.`;
}

/**
 * Kaster TRPCError (BAD_REQUEST) hvis `verdi` overstiger taket for lønnsartens
 * `satsEnhet`. Ukjent/manglende `satsEnhet` faller konservativt til 24-taket.
 * Brukes av de kastende skrivestiene; `syncBatch` bruker `maksForSatsEnhet`/
 * `takFeilmelding` direkte fordi den avviser pr. sedel (push + continue).
 */
export function krevRadInnenforTak(
  verdi: number,
  satsEnhet: string | null | undefined,
): void {
  if (verdi > maksForSatsEnhet(satsEnhet)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: takFeilmelding(verdi, satsEnhet),
    });
  }
}
