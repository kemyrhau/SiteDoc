/**
 * Bundet flyt (bundet-flyt-mobil 2026-09-17): avgjør om «Bytt flyt» skal vises i mobilens
 * handlingslinje, eller om den skal erstattes av bundet-fotnoten.
 *
 * Ren utledning — trukket ut av `DokumentHandlingslinje.tsx` så beslutningen kan testes i
 * mobil-harnessen (ren TS, ingen RN-render). Regelen speiler web: `bundet` er en EGENSKAP ved
 * flyten (fra `gjeldende.bundet`), ALDRI rettigheten `kanFlytte`. En bundet flyt skjuler
 * «Bytt flyt» — men IKKE stille: fotnoten vises der knappen ville stått.
 */
export interface FlytbytteInput {
  /** Server-rettigheten `kanFlytte` (kanByttFlyt) — URØRT av bundet-logikken. */
  kanFlytte?: boolean;
  /** Antall ANDRE flyter brukeren kan bytte til. */
  andreAntall: number;
  /** Egen flyt bundet (egenskap ved flyten). */
  egenFlytBundet: boolean;
}

export interface FlytbytteVisning {
  /** Vis «Bytt flyt»-raden (kun når flytting er lov OG flyten ikke er bundet). */
  harFlytBytte: boolean;
  /** Vis bundet-fotnoten i stedet — der «Bytt flyt» ellers ville stått. */
  visBundetFotnote: boolean;
}

export function utledFlytbytteVisning(input: FlytbytteInput): FlytbytteVisning {
  // «Ville hatt» flytbytte = nøyaktig den gamle betingelsen (rettighet + finnes andre flyter).
  const villeHattFlytBytte = input.kanFlytte === true && input.andreAntall > 0;
  return {
    harFlytBytte: villeHattFlytBytte && !input.egenFlytBundet,
    visBundetFotnote: villeHattFlytBytte && input.egenFlytBundet,
  };
}
