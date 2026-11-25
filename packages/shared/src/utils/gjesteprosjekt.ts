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

/**
 * Prosjektvelgerens «Prosjekter i andre firma»-gruppe (POST 2026-11-15 (16), punkt 2).
 *
 * `prosjekt.hentGjesteprosjekter` er uavhengig av valgt firma: et firma brukeren har VALGT,
 * men ikke er ansatt i (typisk sitedoc_admin), gir gjesteprosjekter som eies av nettopp det
 * valgte firmaet. De hører hjemme i hovedlista (Alle/Mine-filteret), ikke under «andre firma».
 * Gruppen viser derfor bare prosjekter der eier-firmaet ≠ valgt firma. Uten valgt firma vises
 * hele gjestelista som før. Påvirker kun visningen — ikke tilgang eller Timer-skjuling.
 */
export function gjesteprosjekterIAndreFirma<T extends { primaryOrganizationId: string | null }>(
  gjesteprosjekter: readonly T[],
  valgtFirmaId: string | null | undefined,
): T[] {
  if (!valgtFirmaId) return [...gjesteprosjekter];
  return gjesteprosjekter.filter((p) => p.primaryOrganizationId !== valgtFirmaId);
}

/**
 * ADMIN-GJEST (Kenneth 2026-11-25, `web.md` § «Prosjekter i andre firma»): sitedoc_admin som
 * står i et firma hen ikke er aktivt ansatt i, skal se velgeren slik firmaets ansatte ser den —
 * bare det firmaets prosjekter. Ukjent ansatt-status (`null`/`undefined`) gir dagens atferd.
 */
export function erAdminIFremmedFirma(args: {
  rolle: string | null | undefined;
  erAnsattIValgtFirma: boolean | null | undefined;
}): boolean {
  return args.rolle === "sitedoc_admin" && args.erAnsattIValgtFirma === false;
}

/**
 * Gruppen «Prosjekter i andre firma» slik velgeren viser den (web + mobil). Tom for admin i
 * fremmed firma; ellers (16)-regelen `gjesteprosjekterIAndreFirma`. Påvirker kun visningen.
 */
export function velgerGjestegruppe<T extends { primaryOrganizationId: string | null }>(
  gjesteprosjekter: readonly T[],
  valgtFirmaId: string | null | undefined,
  adminIFremmedFirma: boolean,
): T[] {
  if (adminIFremmedFirma) return [];
  return gjesteprosjekterIAndreFirma(gjesteprosjekter, valgtFirmaId);
}

/**
 * Gjeste-IDer som skal beskytte valgt prosjekt mot nullstilling ved firmabytte (tillegg A,
 * orkestrator 2026-11-25). Admin i fremmed firma: ingen — et valgt gjesteprosjekt nullstilles
 * som et eget-firma-prosjekt, slik en ansatt i det valgte firmaet aldri har det valgt.
 */
export function gjesteIderForNullstilling(
  gjesteIder: readonly string[],
  adminIFremmedFirma: boolean,
): string[] {
  return adminIFremmedFirma ? [] : [...gjesteIder];
}

export interface ProsjektForNullstilling {
  id: string;
  primaryOrganizationId: string | null;
}

/**
 * Skal valgt prosjekt nullstilles ved firmabytte? Delt av web (`prosjekt-kontekst.tsx`) og
 * mobil (`ProsjektKontekst.tsx`, ordre (19)) — flyttet fra `apps/web/src/lib/gjesteprosjekt.ts`.
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
