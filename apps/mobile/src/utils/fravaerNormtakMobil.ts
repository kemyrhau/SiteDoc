import {
  harNormtak,
  erFravaerArt,
  restForFravaerMedTak,
  vurderFravaerNormtak,
  type NormtakBruddData,
} from "@sitedoc/shared";

/**
 * B10 på telefon (ORDRE (33) c3, kort-id-spec § 11.10.4 «Mobil (ordre c)»).
 * Tynt lag over den delte regelen i `@sitedoc/shared` (`fravaerNormtak.ts`): mobilens
 * lokale rader + katalogoppslag inn, brudd-linja og resten for én rad ut. Ingen egen
 * aritmetikk — taket og bruddet regnes bare i shared (én kilde).
 */

/** Lønnsarten slik den lokale katalogen bærer den (`lonnsart_local`). */
export interface NormtakArt {
  type: string;
  navn: string;
  fravaerNormtak: boolean | null;
}

export interface NormtakDagRad {
  id: string;
  lonnsartId: string | null;
  timer: number;
  /** Reise teller ikke som arbeid (N8) — kalleren gir visningsregelen. */
  erReise: boolean;
}

type FinnArt = (lonnsartId: string | null) => NormtakArt | null;

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Dagens brudd med ett-trykks retting. `rettTil` 0 = «Slett fraværet» (N6). */
export interface NormtakBruddMobil {
  data: NormtakBruddData;
  /** Raden ett trykk retter: siste fraværslinje med tak. */
  radId: string;
  rettTil: number;
}

/**
 * Brudd som oppstår etterpå (N5): fravær med tak over taket. `null` = intet brudd
 * (eller ukjent norm, L3). Ett trykk retter den SISTE linja med tak — med flere linjer
 * vises linja igjen til dagen er innenfor (N2: linjene deler taket).
 */
export function bruddForDag(args: {
  dagsnorm: number | null;
  rader: readonly NormtakDagRad[];
  finnArt: FinnArt;
}): NormtakBruddMobil | null {
  if (args.dagsnorm == null || !(args.dagsnorm > 0)) return null;
  const v = vurderFravaerNormtak({
    dagsnorm: args.dagsnorm,
    rader: args.rader.map((r) => ({ timer: r.timer, erReise: r.erReise, lonnsart: args.finnArt(r.lonnsartId) })),
  });
  if (!(v.overTak > 0) || v.tak == null) return null;
  const medTak = args.rader.filter((r) => !r.erReise && harNormtak(args.finnArt(r.lonnsartId)));
  const siste = medTak[medTak.length - 1];
  if (!siste) return null;
  return {
    data: {
      artNavn: args.finnArt(siste.lonnsartId)?.navn ?? "",
      fravaerMedTak: v.fravaerMedTak,
      arbeid: v.arbeid,
      fravaerUtenTak: v.fravaerUtenTak,
      dagsnorm: args.dagsnorm,
      tak: v.tak,
    },
    radId: siste.id,
    rettTil: round2(Math.max(0, siste.timer - v.overTak)),
  };
}

/**
 * Rad-vinduet (TF24): hvor mange timer en fraværsrad med tak høyst kan ha — dagsnorm −
 * arbeid − alt annet fravær på datoen (F10). `lonnsartId` er arten valgt i vinduet nå (et
 * bytte til art med tak gir grensen før lagring). `null` = ingen grense (art uten tak,
 * arbeidsart eller ukjent norm).
 */
export function restForRad(args: {
  dagsnorm: number | null;
  rader: readonly NormtakDagRad[];
  radId: string | null;
  lonnsartId: string | null;
  finnArt: FinnArt;
}): { rest: number; arbeid: number; annetFravaer: number } | null {
  if (args.dagsnorm == null || !(args.dagsnorm > 0)) return null;
  if (!harNormtak(args.finnArt(args.lonnsartId))) return null;
  let arbeid = 0;
  let annetFravaer = 0;
  for (const r of args.rader) {
    if (r.id === args.radId || r.erReise) continue;
    if (erFravaerArt(args.finnArt(r.lonnsartId))) annetFravaer += r.timer;
    else arbeid += r.timer;
  }
  arbeid = round2(arbeid);
  annetFravaer = round2(annetFravaer);
  const rest = restForFravaerMedTak({ dagsnorm: args.dagsnorm, arbeid, annetFravaer });
  return rest == null ? null : { rest, arbeid, annetFravaer };
}

/**
 * Linja under timefeltet (§ 11.10.4): «Høyst 5,5 t — 2,0 t arbeid er ført»; annet fravær
 * nevnes når det finnes. Rest 0: «Dagsnormen er fylt».
 */
export function normtakGrenseTekst(
  t: (nokkel: string, vars?: Record<string, string>) => string,
  g: { rest: number; arbeid: number; annetFravaer: number },
  fmt: (n: number) => string,
): string {
  if (g.rest <= 0) return t("timer.normtak.normFylt");
  const harArbeid = g.arbeid > 0.001;
  const harAnnet = g.annetFravaer > 0.001;
  if (!harArbeid && !harAnnet) return t("timer.normtak.hoystUtenFort", { timer: fmt(g.rest) });
  const fort =
    harArbeid && harAnnet
      ? t("timer.normtak.fortBegge", { arbeid: fmt(g.arbeid), annet: fmt(g.annetFravaer) })
      : harArbeid
        ? t("timer.normtak.fortArbeid", { timer: fmt(g.arbeid) })
        : t("timer.normtak.fortAnnet", { timer: fmt(g.annetFravaer) });
  return t("timer.normtak.hoyst", { timer: fmt(g.rest), fort });
}
