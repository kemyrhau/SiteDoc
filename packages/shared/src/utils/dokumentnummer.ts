/**
 * Dokumentnummer for visning i lister: `${prefix}${nummer}` (f.eks. «SJA12»).
 *
 * Skilt ut fra mobil-`DokumentRadHjelpere.tsx` da den var kopiert lokalt i seks
 * listeskjermer (hjem, innboks, hms, sjekkliste, oppgave × 2). Den rene
 * strengfunksjonen hører i @sitedoc/shared; søke-uthevingen (`MedUtheving`) blir
 * i mobil fordi den bruker react-native `Text`.
 *
 * 🔴 `nummer == null` slipper `0` gjennom MED VILJE — «PREFIX0» er et gyldig
 * dokumentnummer. Ikke bytt til `!nummer`; det er dekket av test.
 */
export function formaterNummer(
  prefix: string | null | undefined,
  nummer: number | null | undefined,
): string | null {
  if (!prefix || nummer == null) return null;
  return `${prefix}${nummer}`;
}
