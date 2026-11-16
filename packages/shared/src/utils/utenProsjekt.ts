/**
 * Fravær uten prosjekt (kort-id-spec § 11.2). Databasens CHECK sikrer formen
 * (ingen prosjekt, byggeplass, underprosjekt, maskin eller reise når flagget er
 * satt), men kan ikke lese lønnsarten. Denne funksjonen bærer resten: flagget
 * krever en lønnsart av typen «fravaer». Kalles fra hver server-skrivevei
 * (§ 11.4), syncBatch (§ 11.3) og F7 (lonnsart.oppdater).
 */

export type UtenProsjektGrunn =
  /** Flagget satt, men lønnsarten er ikke fravær. */
  | "utenProsjektKreverFravaer"
  /** Flagget satt sammen med prosjekt, byggeplass, underprosjekt, maskin eller reise. */
  | "utenProsjektMedKnytning"
  /** Uten flagg og uten prosjekt — arbeidsrad må ha prosjekt. */
  | "manglerProsjekt";

export interface UtenProsjektRad {
  utenProsjekt?: boolean | null;
  projectId?: string | null;
  byggeplassId?: string | null;
  externalCostObjectId?: string | null;
  vehicleId?: string | null;
  erReise?: boolean | null;
}

export type UtenProsjektResultat = { ok: true } | { ok: false; grunn: UtenProsjektGrunn };

export function validerUtenProsjekt(
  rad: UtenProsjektRad,
  lonnsartType: string | null | undefined,
): UtenProsjektResultat {
  if (rad.utenProsjekt) {
    if (lonnsartType !== "fravaer") return { ok: false, grunn: "utenProsjektKreverFravaer" };
    if (
      rad.projectId ||
      rad.byggeplassId ||
      rad.externalCostObjectId ||
      rad.vehicleId ||
      rad.erReise
    ) {
      return { ok: false, grunn: "utenProsjektMedKnytning" };
    }
    return { ok: true };
  }
  if (!rad.projectId) return { ok: false, grunn: "manglerProsjekt" };
  return { ok: true };
}

/** Brukervendt melding (server-feil; api har ingen server-i18n). */
export const UTEN_PROSJEKT_MELDING: Record<UtenProsjektGrunn, string> = {
  utenProsjektKreverFravaer: "Rad uten prosjekt krever en lønnsart av typen fravær",
  utenProsjektMedKnytning: "Fravær uten prosjekt kan ikke ha prosjekt, underprosjekt, byggeplass, maskin eller reise",
  manglerProsjekt: "Prosjekt er påkrevd",
};
