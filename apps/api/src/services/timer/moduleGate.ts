/**
 * Modul-gating for Timer-modulen.
 *
 * Steg 1c Fase A — moduleGate kan nå sjekke ProjectModule (per prosjekt)
 * i tillegg til Organization.har_timer_modul (firma-bredt). Sjekk er additiv:
 * begge må være aktivert for at modulen skal anses aktiv på et prosjekt.
 *
 * - Uten projectId: kun firma-bredt flagg (bakoverkompatibel — eksisterende
 *   callsites fortsetter å fungere uendret).
 * - Med projectId: krever både firma-flagg OG ProjectModule.status='aktiv'
 *   for (projectId, 'timer', organizationId).
 *
 * Bakfyll av ProjectModule-rader skjer i 20260503010000_steg_1c_module_backfill.
 * Auto-sync ved nytt prosjekt + firmamodul-toggle bygges i Fase B.
 * har_timer_modul-kolonnen droppes i Fase C.
 */
import { prisma } from "@sitedoc/db";

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
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { harTimerModul: true },
  });
  if (!org?.harTimerModul) return false;
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
