// ============================================================================
//  B10 — fravær med tak og dagsnormen (kort-id-spec § 11.10.3). Én kilde for
//  server, web og mobil. Ren aritmetikk; ingen DB-kall.
//
//  Arbeidet regnes som før (N1). Fravær med tak kan høyst fylle det som er igjen
//  av dagsnormen etter arbeid og fravær uten tak (N2/N3). Arbeid og fravær uten tak
//  avvises aldri av taket (N4). Ukjent norm (≤ 0) → intet tak (L3).
// ============================================================================

/** Lønnsarten redusert til det taket trenger. */
export interface NormtakLonnsart {
  type?: string | null;
  /** `timer.lonnsarter.fravaer_normtak`. Ukjent (null/udefinert) = tak. */
  fravaerNormtak?: boolean | null;
}

/**
 * Den ENESTE leseren av `fravaerNormtak` (glue-vakt i testen). Leses bare for
 * fravær-arter; ukjent verdi gir tak (feil vei koster minst, § 11.10.2).
 */
export function harNormtak(lonnsart: NormtakLonnsart | null | undefined): boolean {
  return lonnsart?.type === "fravaer" && lonnsart.fravaerNormtak !== false;
}

/** Fravær — med eller uten tak (type alene). */
export function erFravaerArt(lonnsart: NormtakLonnsart | null | undefined): boolean {
  return lonnsart?.type === "fravaer";
}

export interface NormtakRad {
  timer: number;
  erReise: boolean;
  /** Rad erstattet ved firma-admin-redigering — teller ikke. */
  erstattet?: boolean;
  lonnsart: NormtakLonnsart | null | undefined;
}

export interface FravaerNormtakVurdering {
  /** L1-grunnlaget: ikke reise, ikke fravær, ikke erstattet. */
  arbeid: number;
  fravaerMedTak: number;
  fravaerUtenTak: number;
  /** max(0, dagsnorm − arbeid − fravær uten tak); `null` = ukjent norm, intet tak. */
  tak: number | null;
  /** Hvor mye fravær med tak ligger over taket (0 = intet brudd). */
  overTak: number;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Grensen et brudd må overstige (avrunding). */
export const NORMTAK_TOLERANSE = 0.01;

/**
 * Det én fraværslinje med tak høyst kan være: dagsnorm − arbeid − alt annet fravær
 * på datoen (F10), aldri under 0. `null` når normen er ukjent.
 */
export function restForFravaerMedTak(args: {
  dagsnorm: number;
  arbeid: number;
  annetFravaer: number;
}): number | null {
  if (!(args.dagsnorm > 0)) return null;
  return round2(Math.max(0, args.dagsnorm - args.arbeid - args.annetFravaer));
}

export function vurderFravaerNormtak(args: {
  dagsnorm: number;
  rader: readonly NormtakRad[];
}): FravaerNormtakVurdering {
  let arbeid = 0;
  let fravaerMedTak = 0;
  let fravaerUtenTak = 0;
  for (const r of args.rader) {
    if (r.erstattet || r.erReise) continue; // N8: reise teller ikke
    if (erFravaerArt(r.lonnsart)) {
      if (harNormtak(r.lonnsart)) fravaerMedTak += r.timer;
      else fravaerUtenTak += r.timer;
    } else {
      arbeid += r.timer;
    }
  }
  arbeid = round2(arbeid);
  fravaerMedTak = round2(fravaerMedTak);
  fravaerUtenTak = round2(fravaerUtenTak);
  const tak = restForFravaerMedTak({ dagsnorm: args.dagsnorm, arbeid, annetFravaer: fravaerUtenTak });
  const over = tak === null ? 0 : round2(fravaerMedTak - tak);
  return {
    arbeid,
    fravaerMedTak,
    fravaerUtenTak,
    tak,
    overTak: over > NORMTAK_TOLERANSE ? over : 0,
  };
}

/** Er dagen i brudd? */
export function erNormtakBrudd(v: Pick<FravaerNormtakVurdering, "overTak">): boolean {
  return v.overTak > NORMTAK_TOLERANSE;
}

/** Bruddet slik serveren sender det til klientene (tall, ikke tekst). */
export interface NormtakBruddData {
  artNavn: string;
  fravaerMedTak: number;
  arbeid: number;
  fravaerUtenTak: number;
  dagsnorm: number;
  /** Det fraværet med tak høyst kan være (0 = slett linja). */
  tak: number;
}

/**
 * Bruddlinja til visning (web nå, mobil i c): «Egenmelding 7,5 t + arbeid 2,0 t = 9,5 t —
 * over dagsnormen 7,5 t». Annet fravær nevnes når det finnes. Tar `t` og en tallformaterer
 * (pakken er i18n-fri), samme mønster som `byggAvvikLinje`.
 */
export function byggNormtakBruddLinje(
  t: (nokkel: string, vars?: Record<string, string>) => string,
  brudd: NormtakBruddData,
  fmt: (n: number) => string,
): string {
  const ledd = [t("timer.normtak.leddArt", { art: brudd.artNavn, timer: fmt(brudd.fravaerMedTak) })];
  if (brudd.arbeid > 0.001) ledd.push(t("timer.normtak.leddArbeid", { timer: fmt(brudd.arbeid) }));
  if (brudd.fravaerUtenTak > 0.001) {
    ledd.push(t("timer.normtak.leddAnnet", { timer: fmt(brudd.fravaerUtenTak) }));
  }
  const sum = round2(brudd.fravaerMedTak + brudd.arbeid + brudd.fravaerUtenTak);
  return t("timer.normtak.brudd", {
    ledd: ledd.join(" + "),
    sum: fmt(sum),
    norm: fmt(brudd.dagsnorm),
  });
}
