/**
 * Gjesteprosjekt (POST 2026-11-15 (15), Kenneth-vedtak 1): et prosjekt brukeren er aktivt
 * medlem av, men som eies av et firma brukeren IKKE er aktivt ansatt i.
 *
 * Definisjon:
 *   - prosjektet har eier-firma (`primaryOrganizationId ≠ null` — standalone er aldri gjest), og
 *   - eier-firmaet er ikke blant brukerens aktive ansettelser (OrganizationMember status «aktiv»).
 *
 * Medlemskapet (aktivt ProjectMember) sjekkes av kalleren — funksjonen avgjør kun eierskapet.
 * En deaktivert ansettelse i eier-firmaet teller ikke som ansettelse; slike prosjekter
 * filtreres bort av serveren før de når klienten (hentDeaktiverteOrgIder).
 */
export function erGjesteprosjekt(
  prosjekt: { primaryOrganizationId: string | null },
  mineAktiveFirmaIder: readonly string[],
): boolean {
  if (!prosjekt.primaryOrganizationId) return false;
  return !mineAktiveFirmaIder.includes(prosjekt.primaryOrganizationId);
}

/**
 * Skal en firmamodul skjules på et gjesteprosjekt? (Kenneth-vedtak 1: timer følger eget
 * prosjekt.)
 *   - Timer: skjules for gjest, UNNTATT når eget firma er koblet til prosjektet via
 *     ProjectOrganization — da er prosjektet også firmaets (prosjektTilhørerFirmaWhere), og
 *     timer kan føres som i dag.
 *   - Varelager (Vareforbruk): skjules alltid for gjest.
 * Ikke-gjest → aldri skjult her (øvrige modul-regler gjelder som før).
 */
export function skjulFirmaModulForGjest(
  modul: "timer" | "varelager",
  gjest: { erGjest: boolean; firmaKoblet: boolean },
): boolean {
  if (!gjest.erGjest) return false;
  if (modul === "timer") return !gjest.firmaKoblet;
  return true;
}
