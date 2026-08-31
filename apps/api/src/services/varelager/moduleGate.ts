/**
 * Modul-gating for Vareforbruk-modulen (Steg 4b).
 *
 * Tynn adapter over den delte resolveren (services/modul) — binder slug + feiltype.
 * Formelen (firmatak ∧ prosjektbryter) bor nå ett sted, ikke duplisert per modul.
 *   - Uten projectId: kun firma-master-bryter (OrganizationModule).
 *   - Med projectId: firma-master-bryter OG ProjectModule.status='aktiv'.
 */
import { effektivTilstand } from "../modul";

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
  return effektivTilstand("varelager", { firmaId: organizationId, prosjektId: projectId });
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
