/**
 * Modul-gating for Timer-modulen.
 *
 * Tynn adapter over den delte resolveren (services/modul) — binder slug + feiltype.
 * Formelen (firmatak ∧ prosjektbryter) bor nå ett sted, ikke duplisert per modul.
 *   - Uten projectId: kun firma-master-bryter (OrganizationModule).
 *   - Med projectId: firma-master-bryter OG ProjectModule.status='aktiv'.
 */
import { effektivTilstand } from "../modul";

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
  return effektivTilstand("timer", { firmaId: organizationId, prosjektId: projectId });
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
