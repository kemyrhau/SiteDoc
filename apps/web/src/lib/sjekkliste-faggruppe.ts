/**
 * Faggruppe-navn med null-vakt for sjekklistelista.
 *
 * Relasjonene `bestillerFaggruppe`/`utforerFaggruppe` er `Faggruppe?` i schema
 * (Prisma-default SetNull). Slettes en faggruppe som er bestiller/utfører på en
 * sjekkliste, blir feltet `null` på eksisterende rader. Uten vakt krasjet
 * sjekklistesiden på `.name` (hvit side, `Cannot read properties of null`).
 *
 * `tom` styrer fallback per bruksflate — samme presedens som resten av fila:
 *   - celler: "—" (jf. `df.faggruppe?.name ?? "—"`)
 *   - sortering/filter-verdi: "" (jf. `s.bestiller?.name ?? ""`)
 * I filter-byggingen faller "" (som `undefined`) ut via `bygg()`s `filter(Boolean)`,
 * så en slettet faggruppe blir ikke et eget «—»-filteralternativ.
 */
export function faggruppeNavn(
  fg: { name: string } | null | undefined,
  tom = "",
): string {
  return fg?.name ?? tom;
}
