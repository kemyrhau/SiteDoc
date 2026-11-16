// B10 (kort-id-spec § 11.10.4): bruddlinja på web. Tallene kommer fra serveren
// (`fravaerNormtakBrudd`); teksten bygges av den delte `byggNormtakBruddLinje`.
import { byggNormtakBruddLinje, type NormtakBruddData } from "@sitedoc/shared";

type T = (nokkel: string, vars?: Record<string, string>) => string;

/** «7,5» / «5,25» — én desimal, to når det trengs, i brukerens språk. */
export function formaterNormtakTimer(n: number, sprak: string): string {
  return n.toLocaleString(sprak, { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

export function normtakBruddLinje(
  t: T,
  brudd: NormtakBruddData | null | undefined,
  sprak: string,
): string | null {
  if (!brudd) return null;
  return byggNormtakBruddLinje(t, brudd, (n) => formaterNormtakTimer(n, sprak));
}
