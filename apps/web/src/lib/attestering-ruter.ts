/**
 * w10b (S3): de gamle attesteringsadressene sender til /dashbord/attestering. Bare det lukkede
 * settet av parametre følger med (visning/uke/fane, retur-konteksten fraVisning/fraUke/fraFane
 * og firma) — aldri en vilkårlig adresse, så omdirigeringen kan ikke brukes som open redirect.
 */
const BEHOLDES = ["visning", "uke", "fane", "fraVisning", "fraUke", "fraFane", "firma"] as const;

export function attesteringRedirectUrl(
  maal: string,
  searchParams: Record<string, string | string[] | undefined> | undefined,
): string {
  const p = new URLSearchParams();
  for (const k of BEHOLDES) {
    const v = searchParams?.[k];
    const verdi = Array.isArray(v) ? v[0] : v;
    if (verdi !== undefined && verdi !== "") p.set(k, verdi);
  }
  const qs = p.toString();
  return qs ? `${maal}?${qs}` : maal;
}
