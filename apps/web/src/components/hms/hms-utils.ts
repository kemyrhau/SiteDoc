import type { HmsKontakt } from "./HmsBehandlerHandlinger";

/**
 * Delte hjelpere for HMS-synlighet (Ordre 2.1). HMS-gruppa identifiseres på
 * domenet "hms" (ikke navn/slug) — samme kriterium som seedHmsModulOmradet setter.
 * Brukes av matrise, flyt-oppsett, kontaktside og HmsTomBanner så deteksjonen er
 * én kilde, ikke duplisert per flate.
 */

export interface HmsGruppeMedlem {
  /** ProjectGroupMember-id (for fjerning fra gruppa) */
  id: string;
  projectMember: { id: string; user: { id: string; name: string | null } } | null;
}

export interface HmsGruppe {
  id: string;
  name: string;
  domains?: unknown;
  members: HmsGruppeMedlem[];
}

/** True hvis gruppas domener inneholder "hms" (JSON-array fra Prisma). */
export function erHmsGruppe(gruppe: { domains?: unknown }): boolean {
  const d = gruppe.domains;
  return Array.isArray(d) && d.includes("hms");
}

/** Finn HMS-gruppa i en liste av prosjektgrupper (domene "hms"). */
export function finnHmsGruppe<T extends HmsGruppe>(grupper: T[] | undefined): T | null {
  if (!grupper) return null;
  return grupper.find((g) => erHmsGruppe(g)) ?? null;
}

/** Sett av ProjectMember-id-er som er behandlere (medlem i HMS-gruppa). */
export function hmsBehandlerMedlemsIder(hmsGruppe: HmsGruppe | null): Set<string> {
  const ider = new Set<string>();
  if (!hmsGruppe) return ider;
  for (const m of hmsGruppe.members) {
    if (m.projectMember) ider.add(m.projectMember.id);
  }
  return ider;
}

interface MedlemForKontakt {
  id: string;
  user: { name: string | null; email: string };
}

/** Bygg kontaktliste for behandler-velgeren (alle prosjektkontakter + erMedlem-flagg). */
export function byggHmsKontakter(
  medlemmer: MedlemForKontakt[] | undefined,
  hmsGruppe: HmsGruppe | null,
): HmsKontakt[] {
  if (!medlemmer) return [];
  const behandlere = hmsBehandlerMedlemsIder(hmsGruppe);
  return medlemmer.map((m) => ({
    id: m.id,
    navn: m.user.name,
    epost: m.user.email,
    erMedlem: behandlere.has(m.id),
  }));
}
