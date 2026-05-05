/**
 * Modul-gating for Timer-modulen.
 *
 * To-nivås aktivering (Steg 1c + Steg 1e, 2026-05-05):
 *   - OrganizationModule(slug='timer', status='aktiv') = firma-master-bryter
 *     (firmaet har modulen aktivert overhodet — kreves for onboarding av
 *     lønnsarter selv før første prosjekt finnes).
 *   - ProjectModule(slug='timer', organizationId, status='aktiv') = prosjekt-
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

export class TimerModulIkkeAktivertError extends Error {
  constructor(public organizationId: string, public projectId?: string) {
    const scope = projectId ? `prosjekt ${projectId}` : `firma ${organizationId}`;
    super(`Timer-modulen er ikke aktivert for ${scope}`);
    this.name = "TimerModulIkkeAktivertError";
  }
}

/**
 * Soft-sjekk — returnerer boolean, kaster ikke.
 */
export async function erTimerAktivert(
  organizationId: string,
  projectId?: string,
): Promise<boolean> {
  if (!(await erFirmamodulAktivert(organizationId, "timer"))) return false;
  if (!projectId) return true;

  const modul = await prisma.projectModule.findFirst({
    where: {
      projectId,
      moduleSlug: "timer",
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
export async function krevTimerAktivert(
  organizationId: string,
  projectId?: string,
): Promise<void> {
  if (!(await erTimerAktivert(organizationId, projectId))) {
    throw new TimerModulIkkeAktivertError(organizationId, projectId);
  }
}
