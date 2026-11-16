import { radProsjektId } from "@sitedoc/shared";

/* ============================================================================
 *  Fraværskortet over synk (prosjektkort-kortid-spec § 11.2–11.3, ordre c2).
 *
 *  Push: `utenProsjekt: true` → intet prosjekt, byggeplass eller underprosjekt
 *  (serveren lagrer NULL og avviser rader uten fravær-art). Prosjektrad: dagens
 *  fallback via `radProsjektId`; tom streng blir `undefined` (F4-4).
 *  Pull: serverens `utenProsjekt` vinner over sedelens prosjekt. Eldre server
 *  sender ikke feltet → prosjektrad som før.
 * ============================================================================ */

export type ProsjektFeltLokal = {
  projectId: string | null;
  utenProsjekt: boolean | null;
  byggeplassId: string | null;
  externalCostObjectId: string | null;
};

export function prosjektFeltTilServer(
  t: ProsjektFeltLokal,
  sedelProjectId: string | null,
): {
  projectId: string | undefined;
  utenProsjekt?: true;
  byggeplassId: string | null;
  externalCostObjectId: string | null;
} {
  if (t.utenProsjekt) {
    return { projectId: undefined, utenProsjekt: true, byggeplassId: null, externalCostObjectId: null };
  }
  return {
    projectId: radProsjektId(t, { projectId: sedelProjectId }) || undefined,
    byggeplassId: t.byggeplassId,
    externalCostObjectId: t.externalCostObjectId,
  };
}

export function prosjektFeltFraServer(
  t: { projectId: string | null; utenProsjekt?: boolean | null },
  sedelProjectId: string,
): { projectId: string | null; utenProsjekt: boolean } {
  if (t.utenProsjekt) return { projectId: null, utenProsjekt: true };
  // Dagens pull-fallback (`timerSync.ts`, T7-3b1) — også `""` på sedel uten prosjekt.
  return { projectId: t.projectId ?? sedelProjectId, utenProsjekt: false };
}
