/**
 * Gjesteprosjekt på web (POST 2026-11-15 (15)). Rene funksjoner — testet uten React.
 * Regelen for hva som ER et gjesteprosjekt bor i `@sitedoc/shared` (erGjesteprosjekt) og
 * avgjøres på serveren (`prosjekt.hentGjesteprosjekter`).
 */

export interface ProsjektForNullstilling {
  id: string;
  primaryOrganizationId: string | null;
}

/**
 * Skal valgt prosjekt nullstilles ved firmabytte?
 *
 * P1 Fase 2 (2026-05-05): prosjekt som ikke tilhører valgt firma nullstilles. Standalone
 * (eier null) regnes også som mismatch når et firma er valgt.
 *
 * Unntak (15): et gjesteprosjekt (aktivt medlem, eier er et firma brukeren ikke er ansatt i)
 * tilhører aldri valgt firma, men er like fullt brukerens prosjekt — det skal ikke kastes ut
 * ved firmabytte. Mens gjestelista laster, venter vi (ellers nullstilles et gjesteprosjekt
 * før lista er kjent).
 */
export function skalNullstilleProsjekt(input: {
  valgtFirmaId: string | null;
  prosjekt: ProsjektForNullstilling | null;
  gjesteIder: readonly string[];
  lasterGjester: boolean;
}): boolean {
  const { valgtFirmaId, prosjekt, gjesteIder, lasterGjester } = input;
  if (!valgtFirmaId || !prosjekt) return false;
  if (prosjekt.primaryOrganizationId === valgtFirmaId) return false;
  if (lasterGjester) return false;
  if (gjesteIder.includes(prosjekt.id)) return false;
  return true;
}
