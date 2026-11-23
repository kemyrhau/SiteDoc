/**
 * F13c (Kenneth 2026-11-23) — rene hjelpere for dokumentflyt-siden.
 *
 *  - 4A: flyter uten eier-faggruppe (`faggruppeId = null`) samles i «Uten faggruppe» i stedet
 *    for å hoppes over. Før F13c gjorde `if (!df.faggruppeId) continue;` seedens standardflyter
 *    usynlige og uadministrerbare (F13b funn A).
 *  - B: hvilke flyter en faggruppe eier eller står som ledd i, med rollen per ledd — vises i
 *    slette-modalen før sletting.
 */

export interface FlytForGruppering {
  id: string;
  faggruppeId: string | null;
  medlemmer: Array<{ rolle: string; faggruppe?: { id: string } | null }>;
}

export function grupperFlyterPaaFaggruppe<T extends FlytForGruppering>(
  flyter: T[],
): { perFaggruppe: Map<string, T[]>; utenFaggruppe: T[] } {
  const perFaggruppe = new Map<string, T[]>();
  const utenFaggruppe: T[] = [];
  for (const df of flyter) {
    if (!df.faggruppeId) {
      utenFaggruppe.push(df);
      continue;
    }
    const liste = perFaggruppe.get(df.faggruppeId) ?? [];
    liste.push(df);
    perFaggruppe.set(df.faggruppeId, liste);
  }
  return { perFaggruppe, utenFaggruppe };
}

/** Rollene faggruppen har i hver flyt: `"eier"` for eier-faggruppen, ellers leddets `rolle`. */
export function finnBerorteFlyter<T extends FlytForGruppering>(
  flyter: T[],
  faggruppeId: string,
): Array<{ df: T; roller: string[] }> {
  return flyter
    .map((df) => {
      const roller: string[] = [];
      if (df.faggruppeId === faggruppeId) roller.push("eier");
      for (const m of df.medlemmer) {
        if (m.faggruppe?.id === faggruppeId) roller.push(m.rolle);
      }
      return { df, roller: [...new Set(roller)] };
    })
    .filter((x) => x.roller.length > 0);
}
