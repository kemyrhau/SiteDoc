import { erGjesteprosjekt } from "@sitedoc/shared";

/* ============================================================================
 *  Gjesteprosjekter i prosjektvelgeren (POST 2026-11-15 (15)).
 *
 *  Et gjesteprosjekt er et prosjekt brukeren er medlem av, men som eies av et
 *  firma brukeren ikke er ansatt i (`erGjesteprosjekt` i @sitedoc/shared — samme
 *  regel som web og server). Mobilen viser dem i en egen gruppe «Prosjekter i
 *  andre firma» og tar dem ut av hovedlista.
 *
 *  Offline: `prosjekt_local` lagrer prosjektet under EIERENS org-id, så gruppen
 *  utledes fra cachen + brukerens ansettelser. Er ansettelsen ukjent (firmalista
 *  ikke lastet, eller eldre API uten `erAnsatt`), vises ingen gjestegruppe — vi
 *  gjetter ikke, og hovedlista forblir som før.
 * ========================================================================== */

export interface GjesteprosjektRad {
  id: string;
  name: string;
  projectNumber: string | null;
  /** Eierfirmaets navn — `null` offline (cachen har bare org-id). */
  eierFirma: string | null;
}

/**
 * Firma-IDer brukeren er aktivt ansatt i, eller `null` når det ikke er kjent.
 * Ett ukjent firma gjør hele svaret ukjent (vi skal ikke merke et eget firmas
 * prosjekt som gjest på grunn av manglende data).
 */
export function mineAnsattFirmaIder(
  firmaer: ReadonlyArray<{ id: string }>,
  erAnsattIFirma: (orgId: string) => boolean | null,
): string[] | null {
  if (firmaer.length === 0) return null;
  const ider: string[] = [];
  for (const f of firmaer) {
    const ansatt = erAnsattIFirma(f.id);
    if (ansatt === null) return null;
    if (ansatt) ider.push(f.id);
  }
  return ider;
}

/** Gjesteprosjekter fra lokal cache (`prosjekt_local`-rader). */
export function lokaleGjesteprosjekter(
  rader: ReadonlyArray<{ id: string; name: string; projectNumber: string | null; organizationId: string }>,
  mineFirmaIder: readonly string[] | null,
): GjesteprosjektRad[] {
  if (!mineFirmaIder) return [];
  return rader
    .filter((r) => erGjesteprosjekt({ primaryOrganizationId: r.organizationId }, mineFirmaIder))
    .map((r) => ({ id: r.id, name: r.name, projectNumber: r.projectNumber ?? null, eierFirma: null }));
}

/** Server-svaret fra `prosjekt.hentGjesteprosjekter` til listerader. */
export function serverGjesteprosjekter(
  data: ReadonlyArray<{
    id: string;
    name: string;
    projectNumber: string | null;
    primaryOrganization: { name: string } | null;
  }>,
): GjesteprosjektRad[] {
  return data.map((p) => ({
    id: p.id,
    name: p.name,
    projectNumber: p.projectNumber ?? null,
    eierFirma: p.primaryOrganization?.name ?? null,
  }));
}

/** Hovedlista uten prosjekter som vises i gjestegruppen. */
export function utenGjesteprosjekter<T extends { id: string }>(
  liste: readonly T[],
  gjester: ReadonlyArray<{ id: string }>,
): T[] {
  if (gjester.length === 0) return [...liste];
  const ider = new Set(gjester.map((g) => g.id));
  return liste.filter((p) => !ider.has(p.id));
}
