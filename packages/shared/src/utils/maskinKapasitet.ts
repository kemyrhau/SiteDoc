// ============================================================================
//  Maskin-kapasitet — delt regel for "maskin ≤ arbeidstimer per bucket"
//
//  Bøtte-funksjonene under (beregnMaskinBrudd, maskinBucketKapasitet,
//  overstigerMaskinTak) brukes av telefonen til w9m. Serveren og PC bruker
//  jobb-regelen lenger ned (w9: beregnJobbMaskinBrudd m.fl.).
//
//  Invariant per (projectId, externalCostObjectId)-bucket (T.7, låst
//  2026-05-16 + pause-modell 2026-05-18):
//
//      sum(maskin.timer) ≤ sum(arbeid.timer) + pauseMin/60   (+ epsilon)
//
//  pauseMin er sedel-nivå (DailySheet.pauseMin) og tillegges hver bucket —
//  maskin kan gå mens operatør pauser (døgn-utleie).
// ============================================================================

import { arbeidUtenReise } from "./reiseSkille";
import { maskinKreverTimerad } from "./maskinKobling";

/** Epsilon for Decimal-runding (timer lagres med 2 desimaler). */
export const EPSILON_MASKIN_TIMER = 0.001;

/** Rad brukt i bucket-gruppering. `timer` må være konvertert til number. */
export type MaskinKapasitetRad = {
  /** `null` = fravær uten prosjekt (kort-id-spec § 11.2) — egen bøtte uten maskin (FM16). */
  projectId: string | null;
  externalCostObjectId: string | null;
  timer: number;
};

/** Ett brudd på maskin ≤ arbeid-regelen for en gitt bucket. */
export type MaskinBrudd = {
  projectId: string | null;
  externalCostObjectId: string | null;
  maskinSum: number;
  timerSum: number;
};

/** Bucket-nøkkel — identisk med serverens `${pid}|${eco ?? ""}`. */
export function maskinBucketNokkel(
  projectId: string | null,
  externalCostObjectId: string | null,
): string {
  return `${projectId ?? "ingen"}|${externalCostObjectId ?? ""}`;
}

/**
 * Overstiger maskin-summen taket (arbeid + pause) for én bucket?
 * Klient-disable OG server-brudd bruker denne — garantert samme grense.
 */
export function overstigerMaskinTak(
  maskinSumTotal: number,
  arbeidSum: number,
  pauseMin = 0,
): boolean {
  return maskinSumTotal > arbeidSum + pauseMin / 60 + EPSILON_MASKIN_TIMER;
}

/**
 * Kapasitet for én bucket — brukt av klientens inline indikator.
 *
 * - `tak`  = maks maskin-sum tillatt (arbeid + pause)
 * - `ledig` = tak − maskin allerede registrert (ekskl. raden som redigeres);
 *             kan bli negativ (grandfathered eksisterende overshoot).
 *
 * En ny/endret maskin-verdi `v` er OK når `!overstigerMaskinTak(
 * sumMaskinEksisterende + v, arbeidSum, pauseMin)`.
 */
export function maskinBucketKapasitet(input: {
  arbeidSum: number;
  sumMaskinEksisterende: number;
  pauseMin?: number;
}): { tak: number; ledig: number } {
  const tak = input.arbeidSum + (input.pauseMin ?? 0) / 60;
  return { tak, ledig: tak - input.sumMaskinEksisterende };
}

/**
 * Grupperer timer- og maskin-rader per bucket og returnerer bucketene der
 * maskin > arbeid + pause. Telefonen (til w9m); serveren bruker beregnJobbMaskinBrudd.
 */
export function beregnMaskinBrudd(
  timer: MaskinKapasitetRad[],
  maskin: MaskinKapasitetRad[],
  pauseMin = 0,
): MaskinBrudd[] {
  const grupper = new Map<string, MaskinBrudd>();
  const hent = (rad: MaskinKapasitetRad): MaskinBrudd => {
    const k = maskinBucketNokkel(rad.projectId, rad.externalCostObjectId);
    let g = grupper.get(k);
    if (!g) {
      g = {
        projectId: rad.projectId,
        externalCostObjectId: rad.externalCostObjectId,
        timerSum: 0,
        maskinSum: 0,
      };
      grupper.set(k, g);
    }
    return g;
  };

  for (const t of timer) hent(t).timerSum += t.timer;
  for (const m of maskin) hent(m).maskinSum += m.timer;

  const brudd: MaskinBrudd[] = [];
  for (const g of grupper.values()) {
    if (overstigerMaskinTak(g.maskinSum, g.timerSum, pauseMin)) brudd.push(g);
  }
  return brudd;
}

// ============================================================================
//  w9 (plan § 4.4, vedtak B21 A / B22 A / B23 B, Kenneth 2026-11-19):
//  maskintimer høyst jobbens arbeidstimer.
//
//  «Kun maskiner som heatwork eller utleie maskiner/materiell kan ha
//  timer/døgn leie uten at arbeidstimer tilsvarende eller flere er registrert.»
//
//  Per jobb (kort, `kortId`): Σ timer for maskinene som krever fører
//  (`maskinKreverTimerad`, enhet ≠ «døgn») ≤ jobbens arbeidstimer. Arbeid =
//  `arbeidUtenReise` (reise og erstattede rader gir 0). Pausen regnes IKKE med.
//
//  Eldre rader uten jobb (`kortId` null) beholder bøtteregelen over
//  (prosjekt|underprosjekt, arbeid + pause) — men uten døgn-maskiner.
//
//  Døgn-maskiner sperres aldri. Har én døgn-maskin flere timer enn jobbens
//  arbeid, er det et varsel (`doegnOverArbeid`, S2: pr. maskin, ikke summen).
//
//  Funksjonene over (`beregnMaskinBrudd` m.fl.) står til telefonen går over i
//  w9m — de er telefonens regel til da.
// ============================================================================


/** Timerad i jobb-regelen. `timer` er konvertert til number. */
export type JobbArbeidRad = {
  kortId: string | null;
  projectId: string | null;
  externalCostObjectId: string | null;
  timer: number;
  erReise?: boolean | null;
  attestertStatus?: string | null;
};

/** Maskinrad i jobb-regelen. `utleieEnhet` fra maskinregisteret (`Equipment.utleieEnhet`). */
export type JobbMaskinRad = {
  id?: string;
  kortId: string | null;
  projectId: string | null;
  externalCostObjectId: string | null;
  timer: number;
  utleieEnhet: string | null | undefined;
};

/** Ett brudd: maskinene med fører har flere timer enn jobbens arbeid. */
export type MaskinJobbBrudd = {
  /** `kort:<kortId>` for jobber, `boette:<prosjekt>|<underprosjekt>` for eldre rader. */
  nokkel: string;
  kortId: string | null;
  projectId: string | null;
  externalCostObjectId: string | null;
  maskinSum: number;
  /** Jobbens arbeid; for eldre rader (bøtte) med pausen lagt til. */
  arbeidSum: number;
};

/** Varsel (B21 A): én døgn-maskin har flere timer enn jobbens arbeid. */
export type DoegnOverArbeid = {
  nokkel: string;
  kortId: string | null;
  projectId: string | null;
  externalCostObjectId: string | null;
  maskinId: string | null;
  maskinTimer: number;
  arbeidSum: number;
};

/** Jobbens nøkkel: kortet når raden har et, ellers bøtta (eldre rader). */
export function maskinJobbNokkel(rad: {
  kortId: string | null;
  projectId: string | null;
  externalCostObjectId: string | null;
}): string {
  return rad.kortId
    ? `kort:${rad.kortId}`
    : `boette:${maskinBucketNokkel(rad.projectId, rad.externalCostObjectId)}`;
}

const arbeidAv = (r: JobbArbeidRad): number =>
  arbeidUtenReise([{ timer: r.timer, erReise: r.erReise, attestertStatus: r.attestertStatus }]);

/**
 * Jobbens arbeidstimer: timerader med samme kort. For eldre rader (maskinen har
 * ikke kort): alle timerader i samme bøtte + pausen, som bøtteregelen i dag.
 */
export function jobbArbeidSum(
  timer: readonly JobbArbeidRad[],
  jobb: { kortId: string | null; projectId: string | null; externalCostObjectId: string | null },
  pauseMin = 0,
): number {
  if (jobb.kortId) {
    return timer.filter((t) => t.kortId === jobb.kortId).reduce((s, t) => s + arbeidAv(t), 0);
  }
  const b = maskinBucketNokkel(jobb.projectId, jobb.externalCostObjectId);
  return (
    timer
      .filter((t) => maskinBucketNokkel(t.projectId, t.externalCostObjectId) === b)
      .reduce((s, t) => s + arbeidAv(t), 0) +
    pauseMin / 60
  );
}

/**
 * Jobbene der maskinene med fører har flere timer enn arbeidet. Bare jobber med
 * minst én førermaskin vurderes; døgn-maskiner telles aldri.
 */
export function beregnJobbMaskinBrudd(
  timer: readonly JobbArbeidRad[],
  maskin: readonly JobbMaskinRad[],
  pauseMin = 0,
): MaskinJobbBrudd[] {
  const jobber = new Map<string, MaskinJobbBrudd>();
  for (const m of maskin) {
    if (!maskinKreverTimerad(m.utleieEnhet)) continue;
    const nokkel = maskinJobbNokkel(m);
    let j = jobber.get(nokkel);
    if (!j) {
      j = {
        nokkel,
        kortId: m.kortId,
        projectId: m.projectId,
        externalCostObjectId: m.externalCostObjectId,
        maskinSum: 0,
        arbeidSum: jobbArbeidSum(timer, m, pauseMin),
      };
      jobber.set(nokkel, j);
    }
    j.maskinSum += m.timer;
  }
  return [...jobber.values()].filter((j) => j.maskinSum > j.arbeidSum + EPSILON_MASKIN_TIMER);
}

/**
 * Bruddene i `etter` som er nye, eller der overskuddet (maskin − arbeid) har
 * økt. En jobb skrivingen ikke rører, er lik før og etter og gis aldri tilbake —
 * et gammelt brudd stopper derfor ikke føring i andre jobber.
 */
export function nyeEllerOkteBrudd(
  foer: readonly MaskinJobbBrudd[],
  etter: readonly MaskinJobbBrudd[],
): MaskinJobbBrudd[] {
  const foerOver = new Map(foer.map((b) => [b.nokkel, b.maskinSum - b.arbeidSum] as const));
  return etter.filter((b) => {
    const tidligere = foerOver.get(b.nokkel);
    return tidligere === undefined || b.maskinSum - b.arbeidSum > tidligere + EPSILON_MASKIN_TIMER;
  });
}

/**
 * «Høyst X t» ved maskinens timer-felt: jobbens arbeid minus de andre
 * førermaskinene på jobben (aldri under 0). `null` = døgn-maskin, ingen grense.
 */
export function maskinHoyst(input: {
  arbeidSum: number;
  andreForerMaskiner: number;
  utleieEnhet: string | null | undefined;
}): number | null {
  if (!maskinKreverTimerad(input.utleieEnhet)) return null;
  return Math.max(0, input.arbeidSum - input.andreForerMaskiner);
}

/** Er `timer` over grensen fra `maskinHoyst`? */
export function overMaskinHoyst(timer: number, hoyst: number | null): boolean {
  return hoyst !== null && timer > hoyst + EPSILON_MASKIN_TIMER;
}

/** Varselet (B21 A, S2): hver døgn-maskin for seg mot jobbens arbeid. */
export function doegnOverArbeid(
  timer: readonly JobbArbeidRad[],
  maskin: readonly JobbMaskinRad[],
  pauseMin = 0,
): DoegnOverArbeid[] {
  const ut: DoegnOverArbeid[] = [];
  for (const m of maskin) {
    if (maskinKreverTimerad(m.utleieEnhet)) continue;
    const arbeidSum = jobbArbeidSum(timer, m, pauseMin);
    if (m.timer > arbeidSum + EPSILON_MASKIN_TIMER) {
      ut.push({
        nokkel: maskinJobbNokkel(m),
        kortId: m.kortId,
        projectId: m.projectId,
        externalCostObjectId: m.externalCostObjectId,
        maskinId: m.id ?? null,
        maskinTimer: m.timer,
        arbeidSum,
      });
    }
  }
  return ut;
}

/**
 * «Høyst» for hver maskinrad i rekkefølge (w9, 2c): jobbens arbeid minus de
 * andre førermaskinene på samme jobb. `null` for døgn-maskin (ingen grense).
 * Felles for alle PC-vinduene, så de regner likt med serveren.
 */
export function maskinHoystPerRad(
  timer: readonly JobbArbeidRad[],
  maskin: readonly JobbMaskinRad[],
  pauseMin = 0,
): Array<number | null> {
  return maskin.map((m, i) => {
    const nokkel = maskinJobbNokkel(m);
    const andreForerMaskiner = maskin.reduce(
      (s, a, j) =>
        j !== i && maskinKreverTimerad(a.utleieEnhet) && maskinJobbNokkel(a) === nokkel
          ? s + a.timer
          : s,
      0,
    );
    return maskinHoyst({
      arbeidSum: jobbArbeidSum(timer, m, pauseMin),
      andreForerMaskiner,
      utleieEnhet: m.utleieEnhet,
    });
  });
}
