/**
 * «Del opp» ved klokkeslett for hele jobben (web-timeføring w5, bilde 8; Kenneth 2026-11-17,
 * B9/B10). Ren planlegger — ingen database. `delJobb` i `dagsseddel.ts` skriver planen.
 *
 * Regelen:
 *  - En timerrad som slutter senest ved klokkeslettet, blir på del A (jobben som var).
 *  - En timerrad som starter ved eller etter klokkeslettet, går til del B (eget kort).
 *  - En timerrad som krysser klokkeslettet, deles i to: første del beholder radens id (så
 *    maskin og vare koblet til raden blir på del A, som når en rad deles i dag), andre del
 *    opprettes på del B. Lønnsarten følger raden, så overtid som alt er egen rad, havner
 *    der den hører hjemme i tid (bilde 8: «3,5 t Timelønn + 0,5 t Overtid 50 %»).
 *  - Pausen følger den delen som krysser pausevinduet (samme regel som `splittRad`,
 *    `fordelPauseVedSplitt`). Del A sine timer regnes av klokkeslettene minus pausen;
 *    del B får resten, så summen av timene er uendret.
 */

export type JobbTimerRad = {
  id: string;
  fraTid: string | null;
  tilTid: string | null;
  timer: number;
  pauseMin: number;
};

export type JobbDeltRad = {
  id: string;
  /** Del A: fraTid–kl. */
  timerA: number;
  pauseA: number;
  /** Del B: kl–tilTid. */
  timerB: number;
  pauseB: number;
};

export type JobbDelingPlan = {
  /** Rader som blir uendret på del A. */
  paaA: string[];
  /** Rader som flyttes i sin helhet til del B. */
  tilB: string[];
  /** Rader som krysser klokkeslettet og deles. */
  delt: JobbDeltRad[];
};

export type JobbDelingFeil = "manglerKlokkeslett" | "klUtenforJobben" | "tomDel";

const tilMin = (hhmm: string): number => {
  const [t, m] = hhmm.split(":").map(Number);
  return (t ?? 0) * 60 + (m ?? 0);
};

const rund2 = (n: number): number => Math.round(n * 100) / 100;

export function planleggJobbDeling(
  rader: readonly JobbTimerRad[],
  kl: string,
  fordelPause: (deler: { fraTid: string; tilTid: string }[], pauseMin: number) => number[],
): JobbDelingPlan | { feil: JobbDelingFeil } {
  if (rader.length === 0) return { feil: "tomDel" };
  if (rader.some((r) => !r.fraTid || !r.tilTid || tilMin(r.tilTid) <= tilMin(r.fraTid))) {
    return { feil: "manglerKlokkeslett" };
  }
  const k = tilMin(kl);
  const plan: JobbDelingPlan = { paaA: [], tilB: [], delt: [] };
  for (const r of rader) {
    const fra = tilMin(r.fraTid!);
    const til = tilMin(r.tilTid!);
    if (til <= k) plan.paaA.push(r.id);
    else if (fra >= k) plan.tilB.push(r.id);
    else {
      const [pauseA = 0, pauseB = 0] = fordelPause(
        [
          { fraTid: r.fraTid!, tilTid: kl },
          { fraTid: kl, tilTid: r.tilTid! },
        ],
        r.pauseMin,
      );
      const timerA = rund2((k - fra - pauseA) / 60);
      const timerB = rund2(r.timer - timerA);
      if (timerA <= 0 || timerB <= 0) return { feil: "tomDel" };
      plan.delt.push({ id: r.id, timerA, pauseA, timerB, pauseB });
    }
  }
  const harA = plan.paaA.length > 0 || plan.delt.length > 0;
  const harB = plan.tilB.length > 0 || plan.delt.length > 0;
  if (!harA || !harB) return { feil: "klUtenforJobben" };
  return plan;
}

/** Feilteksten serveren sender (norsk, som resten av timer-ruterens meldinger). */
export const JOBB_DELING_FEILTEKST: Record<JobbDelingFeil, string> = {
  manglerKlokkeslett: "Jobben kan bare deles ved et klokkeslett når alle timeradene har fra og til",
  klUtenforJobben: "Klokkeslettet må ligge mellom jobbens start og slutt",
  tomDel: "Klokkeslettet gir en del uten timer",
};
