/**
 * Status for en AnsattKompetanse basert på utløpsdato.
 * Brukt for fargemarkering i kompetansematrisen (Fase 0.5 § 2 + A.28).
 *
 * - "gyldig": utloper er null (ingen utløp), eller utloper > 90 dager fram i tid
 * - "varsel": utloper er innen 90 dager fra nå
 * - "utlopt": utloper er i fortid
 */
export type KompetanseStatus = "gyldig" | "varsel" | "utlopt";

const VARSEL_DAGER = 90;

export function kompetanseStatus(
  utloper: Date | string | null | undefined,
  naa: Date = new Date(),
): KompetanseStatus {
  if (!utloper) return "gyldig";
  const utloperDato = utloper instanceof Date ? utloper : new Date(utloper);
  if (utloperDato.getTime() < naa.getTime()) return "utlopt";
  const dagerTilUtlop =
    (utloperDato.getTime() - naa.getTime()) / (1000 * 60 * 60 * 24);
  if (dagerTilUtlop < VARSEL_DAGER) return "varsel";
  return "gyldig";
}
