/**
 * Runde 8 timer, mobil (Kenneth 2026-11-28 «A»): hva telefonens lokale «Del opp» skriver for
 * maskin, vare, tillegg, utlegg og reise som hører til timeraden. Fordelingen (forslag og
 * summvakt) er den delte `beregnDelOppFordeling` i @sitedoc/shared — samme som web og server.
 * Her: fra fordeling til skrivinger, uten database, så regelen kan testes ren.
 *
 * Speiler serverens `skrivDelOppTimer`:
 *  - maskin og vare: første del med en andel beholder raden (id-en), de andre delene får en kopi.
 *    Raden følger delens timerad (`sheetTimerId`) og underprosjekt. Mengde blir på raden.
 *  - tillegg og utlegg: flyttes hele til delen, med delens underprosjekt.
 *  - reise: får delens underprosjekt (serverens `velgReiseKort` legger den i delens kort).
 *
 * En vare som alt er sendt (synket) kan bare rettes på nett. Den blir på del 1 med sin andel;
 * de andre delene får nye, ventende linjer som sendes med neste synk.
 */

import type { DelOppFordeling } from "@sitedoc/shared";

export type LokalDel = {
  /** Del 1 = originalens id; de andre delene har nye id-er. */
  id: string;
  ecoId: string | null;
  timer: number;
};

export type LokalKoblet = {
  maskiner: readonly { id: string; ecoId: string | null }[];
  varer: readonly { id: string; ecoId: string | null; synket: boolean }[];
  tillegg: readonly { id: string; ecoId: string | null }[];
  utlegg: readonly { id: string; ecoId: string | null }[];
  reiser: readonly { id: string; ecoId: string | null }[];
};

export type DelOppLokalPlan = {
  maskinOppdater: { id: string; sheetTimerId: string; timer: number; ecoId: string | null }[];
  maskinNye: { kildeId: string; sheetTimerId: string; timer: number; ecoId: string | null }[];
  /** `nett`: synket linje — rettes med `vareforbruk.oppdater` før noe skrives lokalt. */
  vareOppdater: { id: string; sheetTimerId: string; antall: number; ecoId: string | null; nett: boolean }[];
  vareNye: { kildeId: string; sheetTimerId: string; antall: number; ecoId: string | null }[];
  tillegg: { id: string; sheetTimerId: string; ecoId: string | null }[];
  utlegg: { id: string; sheetTimerId: string; ecoId: string | null }[];
  reiser: { id: string; ecoId: string | null }[];
};

const EPS = 0.005;

/** Andeler pr. del → (raden beholdes av første del med andel, resten er kopier). */
function fordelMengde(
  deler: readonly LokalDel[],
  andeler: readonly number[],
  forsteDel: number | null,
): { beholder: number; kopier: number[] } {
  const med = andeler.map((a, i) => (a > EPS ? i : -1)).filter((i) => i >= 0);
  const beholder = forsteDel ?? med[0] ?? 0;
  return { beholder, kopier: med.filter((i) => i !== beholder && i < deler.length) };
}

export function planleggDelOppLokalt(
  deler: readonly LokalDel[],
  koblet: LokalKoblet,
  fordeling: DelOppFordeling,
): DelOppLokalPlan {
  const plan: DelOppLokalPlan = {
    maskinOppdater: [],
    maskinNye: [],
    vareOppdater: [],
    vareNye: [],
    tillegg: [],
    utlegg: [],
    reiser: [],
  };
  for (const m of koblet.maskiner) {
    const andeler = fordeling.maskiner.find((f) => f.id === m.id)?.timer;
    if (!andeler) continue;
    const { beholder, kopier } = fordelMengde(deler, andeler, null);
    const d = deler[beholder]!;
    plan.maskinOppdater.push({ id: m.id, sheetTimerId: d.id, timer: andeler[beholder] ?? 0, ecoId: d.ecoId });
    for (const i of kopier) {
      plan.maskinNye.push({ kildeId: m.id, sheetTimerId: deler[i]!.id, timer: andeler[i]!, ecoId: deler[i]!.ecoId });
    }
  }
  for (const v of koblet.varer) {
    const andeler = fordeling.varer.find((f) => f.id === v.id)?.antall;
    if (!andeler) continue;
    // Synket linje: id-en og koblingen står på del 1 (serveren kan ikke flytte den hit offline).
    const { beholder, kopier } = fordelMengde(deler, andeler, v.synket ? 0 : null);
    const d = deler[beholder]!;
    plan.vareOppdater.push({
      id: v.id,
      sheetTimerId: d.id,
      antall: andeler[beholder] ?? 0,
      ecoId: d.ecoId,
      nett: v.synket,
    });
    for (const i of kopier) {
      plan.vareNye.push({ kildeId: v.id, sheetTimerId: deler[i]!.id, antall: andeler[i]!, ecoId: deler[i]!.ecoId });
    }
  }
  const tilDel = (liste: { id: string; del: number }[], id: string) => deler[liste.find((f) => f.id === id)?.del ?? 0]!;
  for (const r of koblet.tillegg) {
    const d = tilDel(fordeling.tillegg, r.id);
    plan.tillegg.push({ id: r.id, sheetTimerId: d.id, ecoId: d.ecoId });
  }
  for (const r of koblet.utlegg) {
    const d = tilDel(fordeling.utlegg, r.id);
    plan.utlegg.push({ id: r.id, sheetTimerId: d.id, ecoId: d.ecoId });
  }
  for (const r of koblet.reiser) {
    const d = tilDel(fordeling.reiser, r.id);
    if (d.ecoId !== r.ecoId) plan.reiser.push({ id: r.id, ecoId: d.ecoId });
  }
  return plan;
}

/**
 * Synket vare: del 1 må beholde en andel over 0 (`vareforbruk.oppdater` tar bare positivt antall,
 * og linjen kan ikke flyttes til en del serveren ikke har ennå). Offline: hele varen på del 1.
 */
export function synketVareFeil(
  koblet: LokalKoblet,
  fordeling: DelOppFordeling,
  paaNett: boolean,
): { id: string; type: "offline" | "del1" }[] {
  const feil: { id: string; type: "offline" | "del1" }[] = [];
  for (const v of koblet.varer) {
    if (!v.synket) continue;
    const andeler = fordeling.varer.find((f) => f.id === v.id)?.antall ?? [];
    const flyttet = andeler.some((a, i) => i > 0 && a > EPS);
    if (!paaNett && flyttet) feil.push({ id: v.id, type: "offline" });
    else if ((andeler[0] ?? 0) <= EPS) feil.push({ id: v.id, type: "del1" });
  }
  return feil;
}
