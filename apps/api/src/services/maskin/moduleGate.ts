/**
 * Modul-gating for Maskin-modulen.
 *
 * To-nivås aktivering (Steg 1c + Steg 1e, 2026-05-05):
 *   - OrganizationModule(slug='maskin', status='aktiv') = firma-master-bryter.
 *   - ProjectModule(slug='maskin', organizationId, status='aktiv') = prosjekt-
 *     instans. Auto-opprettes via prosjekt.opprett + organisasjon.settFirmamodul
 *     (services/firmamodul.ts holder dem i sync).
 *
 * Sjekk er additiv: begge nivåer må være aktive for at modulen skal anses
 * aktiv på et prosjekt.
 *   - Uten projectId: kun firma-master-bryter.
 *   - Med projectId: krever både firma-master-bryter OG ProjectModule.status='aktiv'.
 */
import { prisma } from "@sitedoc/db";
import { erFirmamodulAktivert } from "../firmamodul";

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
  if (!(await erFirmamodulAktivert(organizationId, "maskin"))) return false;
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
