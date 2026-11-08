import { kortNokkel } from "../lib/prosjektkortMobil";
import type { Dagsforslag, DagsforslagDag } from "./dagsforslag";

/**
 * ORDRE 36b (revidert plan § 5): «Hva gjorde du i dag?» pr. KORT
 * (prosjekt + effektiv byggeplass; underprosjekt inngår ikke i nøkkelen).
 *
 * Nøkkelen i `beskrivelsePerKort` er:
 *  - `projectId` når prosjektet har ETT kort med arbeid — identisk med 36a,
 *    så teksten overlever bytte av dagens byggeplass slik den gjør i dag;
 *  - `kortNokkel(...)` når prosjektet har flere kort samme dag.
 *
 * Effektiv byggeplass = radens egen `byggeplassId ?? sedelens` (arbeidsrader
 * har normalt null = arver dagens).
 */

export type BeskrivelseKort = {
  /** Nøkkelen teksten står under i `beskrivelsePerKort`. */
  nokkel: string;
  projectId: string;
  byggeplassId: string | null;
  /** Prosjektet har flere kort i dag → feltet trenger byggeplassnavn. */
  delerProsjekt: boolean;
};

type RadKortGrunnlag = { projectId: string; byggeplassId: string | null };

function radKortNokkel(rad: RadKortGrunnlag, d: Pick<DagsforslagDag, "byggeplassId">): string {
  return kortNokkel({
    projectId: rad.projectId,
    byggeplassId: rad.byggeplassId ?? d.byggeplassId ?? null,
    ecoId: null,
  });
}

/** Kortene med arbeid (ikke reise) på åpne datoer, i forslagets rekkefølge. */
export function kortMedArbeid(forslag: Dagsforslag): BeskrivelseKort[] {
  const kort: { kortNokkel: string; projectId: string; byggeplassId: string | null }[] = [];
  for (const d of forslag.datoer) {
    if (d.blokkert) continue;
    for (const r of d.rader) {
      if (r.erReise || !(r.timer > 0)) continue;
      const k = radKortNokkel(r, d);
      if (kort.some((x) => x.kortNokkel === k)) continue;
      kort.push({ kortNokkel: k, projectId: r.projectId, byggeplassId: r.byggeplassId ?? d.byggeplassId ?? null });
    }
  }
  return kort.map((k) => {
    const delerProsjekt = kort.filter((x) => x.projectId === k.projectId).length > 1;
    return {
      nokkel: delerProsjekt ? k.kortNokkel : k.projectId,
      projectId: k.projectId,
      byggeplassId: k.byggeplassId,
      delerProsjekt,
    };
  });
}

/** Teksten (trimmet, null = tom) en arbeidsrad på dato `d` skal få. */
export function beskrivelseForRad(
  forslag: Dagsforslag,
  rad: RadKortGrunnlag,
  d: Pick<DagsforslagDag, "byggeplassId">,
): string | null {
  const b = forslag.beskrivelsePerKort;
  if (!b) return null;
  const k = radKortNokkel(rad, d);
  const kort = kortMedArbeid(forslag).find((x) => kortNokkelFraKort(x) === k);
  const nokkel = kort?.nokkel ?? rad.projectId;
  return b[nokkel]?.trim() || null;
}

function kortNokkelFraKort(k: BeskrivelseKort): string {
  return kortNokkel({ projectId: k.projectId, byggeplassId: k.byggeplassId, ecoId: null });
}
