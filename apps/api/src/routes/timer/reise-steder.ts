import { kontorReiseRute } from "@sitedoc/shared";

/**
 * Eksportens fra/til-sted for en reiserad (LAG 2 D2, K5 mottak; serveren regner ikke om).
 * ut: kontor → byggeplass · retur: byggeplass → kontor. Null retning → begge null (gammel
 * backfill-rad), men «Reise: Ja» står.
 *
 * O17 (vedtak-timer-web.md § Reisevinduet pkt 21): en reise mellom to kontorer (ruten i
 * `reiseRegel.overforing` med kontor i begge ender) får fra- og til-kontoret fra ruten, uansett
 * retning. Excel, PDF, skjermrapporten og lønnsoppsettet leser alle denne ene kilden.
 */
export function reiseFraTilSted(
  r: {
    reiseRetning: "ut" | "retur" | null;
    reiseOppmotestedId: string | null;
    byggeplassId: string | null;
    reiseRegel: unknown;
  },
  kontorNavn: (id: string | null) => string | null,
  byggeplassNavn: (id: string | null) => string | null,
): { fraSted: string | null; tilSted: string | null } {
  const kontorRute = kontorReiseRute(r.reiseRegel);
  if (kontorRute) {
    return { fraSted: kontorNavn(kontorRute.fraKontorId), tilSted: kontorNavn(kontorRute.tilKontorId) };
  }
  const stedKontor = kontorNavn(r.reiseOppmotestedId);
  const stedBygg = byggeplassNavn(r.byggeplassId);
  if (r.reiseRetning === "ut") return { fraSted: stedKontor, tilSted: stedBygg };
  if (r.reiseRetning === "retur") return { fraSted: stedBygg, tilSted: stedKontor };
  return { fraSted: null, tilSted: null };
}
