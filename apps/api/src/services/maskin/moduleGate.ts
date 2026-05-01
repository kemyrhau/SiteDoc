/**
 * Modul-gating for Maskin-modulen.
 *
 * Erstatter pr Fase 0 § A.4/A.17 av OrganizationModule + modulProcedure.
 * Frem til da: bruker midlertidig Organization.harMaskinModul-flag.
 */
import { prisma } from "@sitedoc/db";

export class ModulIkkeAktivertError extends Error {
  constructor(public modulSlug: string, public organizationId: string) {
    super(`Modul «${modulSlug}» er ikke aktivert for firma ${organizationId}`);
    this.name = "ModulIkkeAktivertError";
  }
}

/**
 * Soft-sjekk — returnerer boolean, kaster ikke.
 * Bruk i konsumerende moduler (Timer, Aktivitetsfeed) som skal rendere
 * skjult istedet for feil ved deaktivert modul.
 */
export async function erMaskinAktivert(organizationId: string): Promise<boolean> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { harMaskinModul: true },
  });
  return org?.harMaskinModul ?? false;
}

/**
 * Hard-versjon — kastes hvis ikke aktivert.
 * Brukes i Maskin sine egne ruter.
 */
export async function krevMaskinAktivert(organizationId: string): Promise<void> {
  if (!(await erMaskinAktivert(organizationId))) {
    throw new ModulIkkeAktivertError("maskin", organizationId);
  }
}
