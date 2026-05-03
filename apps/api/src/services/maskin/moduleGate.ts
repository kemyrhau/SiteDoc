/**
 * Modul-gating for Maskin-modulen.
 *
 * Steg 1c Fase A — moduleGate kan nå sjekke ProjectModule (per prosjekt)
 * i tillegg til Organization.har_maskin_modul (firma-bredt). Sjekk er additiv:
 * begge må være aktivert for at modulen skal anses aktiv på et prosjekt.
 *
 * - Uten projectId: kun firma-bredt flagg (bakoverkompatibel).
 * - Med projectId: krever både firma-flagg OG ProjectModule.status='aktiv'
 *   for (projectId, 'maskin', organizationId).
 *
 * Bakfyll av ProjectModule-rader skjer i 20260503010000_steg_1c_module_backfill.
 * Auto-sync ved nytt prosjekt + firmamodul-toggle bygges i Fase B.
 * har_maskin_modul-kolonnen droppes i Fase C.
 */
import { prisma } from "@sitedoc/db";

export class ModulIkkeAktivertError extends Error {
  constructor(
    public modulSlug: string,
    public organizationId: string,
    public projectId?: string,
  ) {
    const scope = projectId ? `prosjekt ${projectId}` : `firma ${organizationId}`;
    super(`Modul «${modulSlug}» er ikke aktivert for ${scope}`);
    this.name = "ModulIkkeAktivertError";
  }
}

/**
 * Soft-sjekk — returnerer boolean, kaster ikke.
 */
export async function erMaskinAktivert(
  organizationId: string,
  projectId?: string,
): Promise<boolean> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { harMaskinModul: true },
  });
  if (!org?.harMaskinModul) return false;
  if (!projectId) return true;

  const modul = await prisma.projectModule.findFirst({
    where: {
      projectId,
      moduleSlug: "maskin",
      organizationId,
      status: "aktiv",
    },
    select: { id: true },
  });
  return !!modul;
}

/**
 * Hard-versjon — kastes hvis ikke aktivert.
 */
export async function krevMaskinAktivert(
  organizationId: string,
  projectId?: string,
): Promise<void> {
  if (!(await erMaskinAktivert(organizationId, projectId))) {
    throw new ModulIkkeAktivertError("maskin", organizationId, projectId);
  }
}
