/**
 * Modul-gating for Vareforbruk-modulen (Steg 4b).
 *
 * To-nivås aktivering (samme mønster som Timer/Maskin):
 *   - OrganizationModule(slug='varelager', status='aktiv') = firma-master-bryter
 *     (firmaet har modulen aktivert overhodet — kreves for å onboarde varekatalog
 *     selv før første prosjekt finnes).
 *   - ProjectModule(slug='varelager', organizationId, status='aktiv') = prosjekt-
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

export class VarelagerModulIkkeAktivertError extends Error {
  constructor(public organizationId: string, public projectId?: string) {
    const scope = projectId ? `prosjekt ${projectId}` : `firma ${organizationId}`;
    super(`Varelager-modulen er ikke aktivert for ${scope}`);
    this.name = "VarelagerModulIkkeAktivertError";
  }
}

/**
 * Soft-sjekk — returnerer boolean, kaster ikke.
 */
export async function erVarelagerAktivert(
  organizationId: string,
  projectId?: string,
): Promise<boolean> {
  if (!(await erFirmamodulAktivert(organizationId, "varelager"))) return false;
  if (!projectId) return true;

  const modul = await prisma.projectModule.findFirst({
    where: {
      projectId,
      moduleSlug: "varelager",
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
export async function krevVarelagerAktivert(
  organizationId: string,
  projectId?: string,
): Promise<void> {
  if (!(await erVarelagerAktivert(organizationId, projectId))) {
    throw new VarelagerModulIkkeAktivertError(organizationId, projectId);
  }
}
