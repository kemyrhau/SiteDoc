/**
 * F13c (Kenneth 2026-11-23) — rene hjelpere for dokumentflyt-siden.
 *
 *  - 4A: flyter uten eier-faggruppe (`faggruppeId = null`) samles i «Uten faggruppe» i stedet
 *    for å hoppes over. Før F13c gjorde `if (!df.faggruppeId) continue;` seedens standardflyter
 *    usynlige og uadministrerbare (F13b funn A).
 *  - F13c-2 (F1, Kenneth 2026-11-23): HMS-flyter («HMS-flyt er en egen frittstående faggruppe
 *    med helt egne regler») vises bare i HMS-flyt-kortet, ikke under «Uten faggruppe». En
 *    HMS-flyt er en eierløs flyt med minst én mal i domenet `hms` — samme kjennetegn som
 *    `seedHmsModulOmradet` (services/hmsFlyt.ts) slår opp flyten med.
 *  - B: hvilke flyter en faggruppe eier eller står som ledd i, med rollen per ledd — vises i
 *    slette-modalen før sletting.
 */

export interface FlytForGruppering {
  id: string;
  faggruppeId: string | null;
  medlemmer: Array<{ rolle: string; faggruppe?: { id: string } | null }>;
  maler?: Array<{ template: { domain?: string | null } }>;
}

export function erHmsFlyt(df: FlytForGruppering): boolean {
  return !df.faggruppeId && (df.maler ?? []).some((m) => m.template.domain === "hms");
}

export function grupperFlyterPaaFaggruppe<T extends FlytForGruppering>(
  flyter: T[],
): { perFaggruppe: Map<string, T[]>; utenFaggruppe: T[]; hmsFlyter: T[] } {
  const perFaggruppe = new Map<string, T[]>();
  const utenFaggruppe: T[] = [];
  const hmsFlyter: T[] = [];
  for (const df of flyter) {
    if (erHmsFlyt(df)) {
      hmsFlyter.push(df);
      continue;
    }
    if (!df.faggruppeId) {
      utenFaggruppe.push(df);
      continue;
    }
    const liste = perFaggruppe.get(df.faggruppeId) ?? [];
    liste.push(df);
    perFaggruppe.set(df.faggruppeId, liste);
  }
  return { perFaggruppe, utenFaggruppe, hmsFlyter };
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
