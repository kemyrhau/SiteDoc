/**
 * Modul-gating for Maskin-modulen.
 *
 * Tynn adapter over den delte resolveren (services/modul) — binder slug + feiltype.
 * Formelen (firmatak ∧ prosjektbryter) bor nå ett sted, ikke duplisert per modul.
 *   - Uten projectId: kun firma-master-bryter (OrganizationModule).
 *   - Med projectId: firma-master-bryter OG ProjectModule.status='aktiv'.
 */
import { effektivTilstand } from "../modul";

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
  return effektivTilstand("maskin", { firmaId: organizationId, prosjektId: projectId });
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
