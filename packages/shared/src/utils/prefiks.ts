/**
 * Prefikset til en mal utledes fra bibliotekmalens `referanse`: første token, der token
 * skilles på mellomrom og skråstrek — INGEN andre skilletegn.
 *
 * 🔴 Punktum er TRYGT: «KC3.1» og «UO2.1» skal beholde punktumet (de finnes i dataene nå).
 * Tom/whitespace referanse → `null`.
 *
 * Prefikset blir dokumentnummerets prefiks (`bibliotek.ts`), så en mal uten prefiks
 * produserer dokumenter som ikke kan siteres. Dette er ÉN kilde brukt av BÅDE
 * bibliotek→prosjektmal (`bibliotek.ts`) og bibliotek→firmamal (`firmamal.ts`) — regelen
 * skal ikke kopieres et andre sted.
 */
export function prefiksFraReferanse(referanse: string): string | null {
  const token = referanse.split(/[\s/]/)[0]?.trim();
  return token ? token : null;
}
