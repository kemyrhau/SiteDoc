import type { Dagsforslag } from "./dagsforslag";
import type { LonnUtlegg } from "./dagsforslagAnvend";
import { kortMedFlestTimer, type BeskrivelseKort } from "./beskrivelseKort";

/**
 * Bekreft dag (spec tillegg-utlegg-prosjektkort § 5, B6): hver tillegg-/
 * utleggslinje hører til ett kort. Linja bærer kortets `projectId` +
 * `byggeplassId` (effektiv). Kortet kan forsvinne når rammen endres, og gamle
 * utkast har ingen `byggeplassId` — da faller linja til prosjektets kort med
 * flest timer. Prosjekt uten arbeid → null (linja arver sedelen).
 */
export function kortForLinje(
  linje: { projectId: string; byggeplassId?: string | null },
  kort: BeskrivelseKort[],
  forslag?: Dagsforslag,
): BeskrivelseKort | null {
  if (linje.byggeplassId !== undefined) {
    const eksakt = kort.find((k) => k.projectId === linje.projectId && k.byggeplassId === (linje.byggeplassId ?? null));
    if (eksakt) return eksakt;
  }
  if (forslag) return kortMedFlestTimer(forslag, linje.projectId);
  return kort.find((k) => k.projectId === linje.projectId) ?? null;
}

/** Linjene med kortets byggeplass slik de lagres — kalles ved lagring. */
export function knyttLonnUtleggTilKort(
  lonnUtlegg: LonnUtlegg,
  kort: BeskrivelseKort[],
  forslag?: Dagsforslag,
): LonnUtlegg {
  const bp = (l: { projectId: string; byggeplassId?: string | null }) => kortForLinje(l, kort, forslag)?.byggeplassId ?? null;
  return {
    tillegg: lonnUtlegg.tillegg.map((l) => ({ ...l, byggeplassId: bp(l) })),
    utlegg: lonnUtlegg.utlegg.map((u) => ({ ...u, byggeplassId: bp(u) })),
  };
}
