/**
 * Én kilde for visning av et dokumentnummer på tvers av flater.
 *
 * Bakgrunn: samme `number` ble renderet i fire ulike former av fire uavhengige
 * kopier (mobil-liste «SJA12», web-detaljhode/skriv-ut/PDF-filnavn «SJA-012»,
 * web-listekolonne «012» uten prefiks, papirkurv «SJA-12» uten pad). Formene er
 * IKKE like av vilje — mobil er kompakt, listen har prefiks som egen kolonne — så
 * dette er ÉN funksjon med parametre, ikke ett utseende.
 *
 * 🔴 `packages/pdf` har sin egen (`hjelpere.ts:formaterNummer`) fordi pakken er
 * null-runtime-avhengigheter og ikke kan importere herfra. Den er en TVUNGET
 * tvilling (som `lesSignaturVerdiPdf`/`normaliserOpsjonPdf`) — endres logikken
 * her, må speilet følge etter.
 *
 * 🔴 `nummer == null` gir `null`, men `0` slipper gjennom MED VILJE — «PREFIX0»
 * er et gyldig dokumentnummer. Ikke bytt til `!nummer`; det er dekket av test.
 */
export interface DokumentnummerFormat {
  /** Skilletegn mellom prefiks og nummer. Default "" (mobil-kompakt «SJA12»). */
  separator?: string;
  /** padStart-bredde på nummeret. Default 0 (ingen padding). */
  pad?: number;
  /** Vis prefiks når det finnes. Default true; false = alltid bart nummer (listekolonne). */
  visPrefiks?: boolean;
  /**
   * Hva skjer når prefiks mangler (og `visPrefiks` er true):
   * - "null" (default): hele nummeret blir `null` — mobil-liste viser ikke prefiksløse dokumenter.
   * - "nummer": vis det (padda) nummeret alene — web-detaljhode/PDF «012».
   */
  manglerPrefiks?: "null" | "nummer";
}

export function formaterNummer(
  prefix: string | null | undefined,
  nummer: number | null | undefined,
  format: DokumentnummerFormat = {},
): string | null {
  if (nummer == null) return null;

  const { separator = "", pad = 0, visPrefiks = true, manglerPrefiks = "null" } = format;
  const nummerTekst = pad > 0 ? String(nummer).padStart(pad, "0") : String(nummer);

  if (!visPrefiks) return nummerTekst;
  if (!prefix) return manglerPrefiks === "nummer" ? nummerTekst : null;
  return `${prefix}${separator}${nummerTekst}`;
}
