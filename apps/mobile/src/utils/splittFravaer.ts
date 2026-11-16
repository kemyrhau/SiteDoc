import { bruddForDag, type NormtakArt, type NormtakBruddMobil, type NormtakDagRad } from "./fravaerNormtakMobil";

/**
 * ORDRE (33) SVAR pkt 3 — «Del opp» (SplittRadModal) på en fraværsrad (spec § 11.4, M18):
 * delene arver `utenProsjekt` og kort-id-en `ingen`; underprosjekt følger aldri med.
 * T13 / M18 (c1): alle deler beholder radens byggeplass og — på samme nøkkel — kort-id.
 * Beskrivelsen arves fra originalen (U11: ett felt pr. fraværskort, ikke pr. linje).
 */
export function splittDelVerdier(
  original: {
    utenProsjekt: boolean;
    byggeplassId: string | null;
    kortId: string | null;
    externalCostObjectId: string | null;
  },
  del: { lonnsartId: string; aktivitetId: string; externalCostObjectId: string | null; timer: number },
): {
  utenProsjekt: boolean;
  byggeplassId: string | null;
  kortId: string | null;
  lonnsartId: string;
  aktivitetId: string;
  externalCostObjectId: string | null;
  timer: number;
} {
  const eco = original.utenProsjekt ? null : del.externalCostObjectId;
  return {
    utenProsjekt: original.utenProsjekt,
    // T13 / M18 (ORDRE (33) c1): delen beholder radens byggeplass. Kort-id-en følger med når
    // delen står på samme nøkkel som originalen; nytt underprosjekt = annet kort (K2), så id-en
    // utledes da på nytt av `sikreLokalKortId` (regel 3).
    byggeplassId: original.utenProsjekt ? null : original.byggeplassId,
    kortId: eco === (original.utenProsjekt ? null : original.externalCostObjectId) ? original.kortId : null,
    lonnsartId: del.lonnsartId,
    aktivitetId: del.aktivitetId,
    externalCostObjectId: eco,
    timer: del.timer,
  };
}

/**
 * B10 for delene: dagens rader med originalen byttet ut med delene. Taket gjelder
 * summen av delene (N2). `null` = intet brudd eller ukjent norm (U12).
 */
export function splittNormtakBrudd(args: {
  dagsnorm: number | null;
  dagRader: readonly NormtakDagRad[];
  originalId: string;
  deler: readonly { lonnsartId: string; timer: number }[];
  finnArt: (lonnsartId: string | null) => NormtakArt | null;
}): NormtakBruddMobil | null {
  const rader: NormtakDagRad[] = [
    ...args.dagRader.filter((r) => r.id !== args.originalId),
    ...args.deler.map((d, i) => ({
      id: `${args.originalId}#${i}`,
      lonnsartId: d.lonnsartId,
      timer: d.timer,
      erReise: false,
    })),
  ];
  return bruddForDag({ dagsnorm: args.dagsnorm, rader, finnArt: args.finnArt });
}
