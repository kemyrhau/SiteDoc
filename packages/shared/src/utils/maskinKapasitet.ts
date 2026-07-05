// ============================================================================
//  Maskin-kapasitet — delt regel for "maskin ≤ arbeidstimer per bucket"
//
//  Sannhetskilde for BÅDE server (validerMaskinUnderArbeid i
//  apps/api/.../dagsseddel.ts) OG klient-disable (web + mobil dagsseddel-
//  maskinmodal). Ingen divergens: samme epsilon, samme pause-modell, samme
//  bucket-definisjon.
//
//  Invariant per (projectId, externalCostObjectId)-bucket (T.7, låst
//  2026-05-16 + pause-modell 2026-05-18):
//
//      sum(maskin.timer) ≤ sum(arbeid.timer) + pauseMin/60   (+ epsilon)
//
//  pauseMin er sedel-nivå (DailySheet.pauseMin) og tillegges hver bucket —
//  maskin kan gå mens operatør pauser (døgn-utleie).
// ============================================================================

/** Epsilon for Decimal-runding (timer lagres med 2 desimaler). */
export const EPSILON_MASKIN_TIMER = 0.001;

/** Rad brukt i bucket-gruppering. `timer` må være konvertert til number. */
export type MaskinKapasitetRad = {
  projectId: string;
  externalCostObjectId: string | null;
  timer: number;
};

/** Ett brudd på maskin ≤ arbeid-regelen for en gitt bucket. */
export type MaskinBrudd = {
  projectId: string;
  externalCostObjectId: string | null;
  maskinSum: number;
  timerSum: number;
};

/** Bucket-nøkkel — identisk med serverens `${pid}|${eco ?? ""}`. */
export function maskinBucketNokkel(
  projectId: string,
  externalCostObjectId: string | null,
): string {
  return `${projectId}|${externalCostObjectId ?? ""}`;
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
 * maskin > arbeid + pause. Serverens validerMaskinUnderArbeid delegerer hit.
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
