/**
 * Delt resolver for effektiv modultilstand (steg 2 i modulhierarki-designnotat § 4).
 *
 * ÉN kilde som beregner om en modul er effektivt aktiv. TO familier, TO formler
 * (familie-inventaret 3 + 9, null overlapp, verifisert mot koden 2026-08-31):
 *
 *   Firmamoduler   (timer, maskin, varelager — FirmamodulSlug):
 *       firmatak (OrganizationModule) ∧ [prosjektbryter (ProjectModule) hvis prosjektId]
 *   Prosjektmoduler (de ni i PROSJEKT_MODULER):
 *       prosjektbryter (ProjectModule) alene — intet firmatak, får det aldri
 *
 * Standalone-carveout (designnotat § 2): prosjektmoduler bruker prosjektbryteren
 * alene UANSETT firma. Firmamoduler krever firma — uten firmaId finnes intet kjøp,
 * og familien er utilgjengelig (returnerer false, verken aktiv eller grået).
 *
 * IKKE bygget her (deferres per ordre [4]): underbryter (maskin/varelager som
 * underbrytere av timer — V1) og unntaksliste. Maskin/varelager er fortsatt egne
 * OrganizationModule-slugs. Firmaformelen får ledd for dem når de innføres.
 *
 * 🔴 Designlås som dette sporet bærer (ordre [3], designnotat § 2/§ 4):
 *   1. equipment.list gates ALDRI — TimerSyncProvider:104-108 henter maskin-
 *      katalogen i samme Promise.all som timer-katalogen; en vakt der feller hele
 *      timer-synken på mobil. Resolveren er for SKRIVENDE gater + UI-speil, ikke
 *      for katalog-/leseprosedyrer.
 *   2. De ni prosjektmodulene grås ALDRI mot firmatak — de har ikke noe tak.
 *   3. Standalone-prosjekter mister ALDRI prosjektmoduler.
 *   4. Unntakslisten bor på modulkortet, aldri på ansattkortet — ikke innført her.
 */
import { prisma } from "@sitedoc/db";
import { PROSJEKT_MODULER } from "@sitedoc/shared";
import { erFirmamodulAktivert, type FirmamodulSlug } from "../firmamodul";

export const FIRMAMODUL_SLUGS: readonly FirmamodulSlug[] = ["timer", "maskin", "varelager"];
const PROSJEKTMODUL_SLUGS: ReadonlySet<string> = new Set(PROSJEKT_MODULER.map((m) => m.slug));

export type ModulFamilie = "firma" | "prosjekt";

/**
 * Hvilken familie tilhører slug? null = ukjent modul (ingen av de 3 + 9).
 * Flatene skal aldri selv vite dette — de spør resolveren.
 */
export function modulFamilie(slug: string): ModulFamilie | null {
  if ((FIRMAMODUL_SLUGS as readonly string[]).includes(slug)) return "firma";
  if (PROSJEKTMODUL_SLUGS.has(slug)) return "prosjekt";
  return null;
}

export interface EffektivTilstandOpts {
  firmaId?: string;
  prosjektId?: string;
}

/**
 * Er prosjektbryteren (ProjectModule) aktiv for slug på prosjektet?
 *
 * Firmamoduler bærer organizationId på ProjectModule-raden (sync skriver den) —
 * for dem sendes firmaId inn så vi bevarer den eksakte gjeldende gate-atferden
 * (findFirst med organizationId-filter). Prosjektmoduler har unik (projectId,
 * moduleSlug) og trenger ikke firmaId.
 */
async function erProsjektbryterAktiv(
  prosjektId: string,
  slug: string,
  firmaId?: string,
): Promise<boolean> {
  const rad = await prisma.projectModule.findFirst({
    where: {
      projectId: prosjektId,
      moduleSlug: slug,
      status: "aktiv",
      ...(firmaId ? { organizationId: firmaId } : {}),
    },
    select: { id: true },
  });
  return !!rad;
}

/**
 * Effektiv modultilstand for en slug. Leser BEGGE tabellene for firmafamilien
 * (OrganizationModule for taket, ProjectModule for bryteren) og KUN ProjectModule
 * for prosjektfamilien.
 *
 * @param slug modul-slug (firma: timer/maskin/varelager · prosjekt: de ni)
 * @param opts firmaId (påkrevd for firmafamilien) og/eller prosjektId
 */
export async function effektivTilstand(
  slug: string,
  { firmaId, prosjektId }: EffektivTilstandOpts,
): Promise<boolean> {
  const familie = modulFamilie(slug);
  if (familie === null) return false;

  if (familie === "prosjekt") {
    // Prosjektbryter alene. Intet firmatak (designlås 2/3). Uten prosjekt-kontekst
    // kan tilstanden ikke avgjøres → false.
    if (!prosjektId) return false;
    return erProsjektbryterAktiv(prosjektId, slug);
  }

  // Firmamodul: firmatak ∧ [prosjektbryter hvis prosjektId]. Uten firma finnes
  // intet kjøp — familien er utilgjengelig (standalone-carveout, designlås 3).
  if (!firmaId) return false;
  if (!(await erFirmamodulAktivert(firmaId, slug as FirmamodulSlug))) return false;
  if (!prosjektId) return true;
  return erProsjektbryterAktiv(prosjektId, slug, firmaId);
}
