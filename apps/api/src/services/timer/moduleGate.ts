/**
 * Modul-gating for Timer-modulen.
 *
 * Erstatter pr Fase 0 § A.4/A.17 av OrganizationModule + modulProcedure.
 * Frem til da: bruker midlertidig Organization.harTimerModul-flag.
 * Samme mønster som apps/api/src/services/maskin/moduleGate.ts.
 */
import { prisma } from "@sitedoc/db";

export class TimerModulIkkeAktivertError extends Error {
  constructor(public organizationId: string) {
    super(`Timer-modulen er ikke aktivert for firma ${organizationId}`);
    this.name = "TimerModulIkkeAktivertError";
  }
}

/**
 * Soft-sjekk — returnerer boolean, kaster ikke.
 * Bruk i konsumerende moduler (Aktivitetsfeed, Planlegger) som skal rendere
 * skjult istedet for feil ved deaktivert modul.
 */
export async function erTimerAktivert(organizationId: string): Promise<boolean> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { harTimerModul: true },
  });
  return org?.harTimerModul ?? false;
}

/**
 * Hard-versjon — kastes hvis ikke aktivert.
 * Brukes i Timer-modulens egne ruter.
 */
export async function krevTimerAktivert(organizationId: string): Promise<void> {
  if (!(await erTimerAktivert(organizationId))) {
    throw new TimerModulIkkeAktivertError(organizationId);
  }
}
