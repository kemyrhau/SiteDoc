import type { Dagsforslag } from "./dagsforslag";
import type { LonnUtlegg } from "./dagsforslagAnvend";
import { kortMedFlestTimer, type BeskrivelseKort } from "./beskrivelseKort";

type LinjeKort = { projectId: string; byggeplassId?: string | null; dato?: string; kortId?: string };

/**
 * Bekreft dag (spec tillegg-utlegg-prosjektkort § 5, B6): hver tillegg-/
 * utleggslinje hører til ett kort. Linja bærer kortets `projectId` +
 * `byggeplassId` (effektiv) + `dato` (ORDRE 25, Kenneth 2026-11-16: på en
 * nattevakt velger linja datokortet og lagres på den datoens sedel).
 *  - Linje uten `dato` (utkast fra før 25) → startdatoens kort
 *    (`paaStartDato`); er det kortet borte, stedets første åpne datokort.
 *  - Datoen har ikke kortet lenger (sedelen sendt, rammen endret) → stedets
 *    første åpne datokort. Kortvalget viser det, så ingenting flyttes skjult.
 *  - Gamle utkast uten `byggeplassId` → prosjektets kort med flest timer.
 *  - Prosjekt uten arbeid → null (linja arver første åpne sedel).
 */
export function kortForLinje(
  linje: LinjeKort,
  kort: BeskrivelseKort[],
  forslag?: Dagsforslag,
): BeskrivelseKort | null {
  // Ordre c (spec § 5.1): linja har valgt et kort med id → det kortet, også når
  // to kort deler prosjekt og byggeplass. Finnes det ikke lenger, regnes valget
  // som før (kortvalget viser det, så ingenting flyttes skjult).
  if (linje.kortId) {
    const medId = kort.find((k) => k.kortId === linje.kortId && k.projectId === linje.projectId);
    if (medId) return medId;
  }
  if (linje.byggeplassId !== undefined) {
    const sted = kort.filter((k) => k.projectId === linje.projectId && k.byggeplassId === (linje.byggeplassId ?? null));
    const paaDato = sted.find((k) => (linje.dato === undefined ? k.paaStartDato : k.dato === linje.dato));
    const eksakt = paaDato ?? sted[0];
    if (eksakt) return eksakt;
  }
  if (forslag) return kortMedFlestTimer(forslag, linje.projectId);
  return kort.find((k) => k.projectId === linje.projectId) ?? null;
}

/**
 * Linjene med kortets byggeplass og dato slik de lagres — kalles ved lagring.
 * `dato` styrer sedelen i `anvendDagsforslag`; uten kort (prosjekt uten
 * arbeid) fjernes datoen og linja arver første åpne sedel som før.
 */
export function knyttLonnUtleggTilKort(
  lonnUtlegg: LonnUtlegg,
  kort: BeskrivelseKort[],
  forslag?: Dagsforslag,
): LonnUtlegg {
  const felt = (l: LinjeKort) => {
    const k = kortForLinje(l, kort, forslag);
    return { byggeplassId: k?.byggeplassId ?? null, dato: k?.dato, kortId: k?.kortId };
  };
  return {
    tillegg: lonnUtlegg.tillegg.map((l) => ({ ...l, ...felt(l) })),
    utlegg: lonnUtlegg.utlegg.map((u) => ({ ...u, ...felt(u) })),
  };
}
