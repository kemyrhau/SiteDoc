/**
 * LAG 2 (B6) — reise-gjenkjenning ved VISNING, i én testbar kilde.
 *
 * Etter lag 2 skal ingen leser gjette reise fra lønnsart/regex (M3): visningen
 * leser det EKSPLISITTE `erReise`-flagget på raden. Fallbacken til lønnsart-match
 * gjelder KUN rader uten flagg (`erReise == null`): eldre lokale rader + rader
 * hentet via server-pull før `hentEndringerSiden` returnerer flagget. Den dagen
 * pull-en bærer `erReise`, kan fallbacken (og `reiseLonnsartId`-arg) fjernes.
 */
export function erReiseRadVisning(
  erReise: boolean | null | undefined,
  lonnsartId: string,
  reiseLonnsartId: string | null,
): boolean {
  if (erReise != null) return erReise;
  return reiseLonnsartId != null && lonnsartId === reiseLonnsartId;
}
