/**
 * Prosjekt-referanse for PDF-utskrift. (Sjekkliste-/oppgave-/metadata-header-generatorene
 * ble slettet 2026-08-24 sammen med den døde klient-utskrift-grenen — arkivmalen (`arkivmal/`)
 * bygger nå all header-HTML.)
 */

import type { ProsjektForPdf, Utskriftsinnstillinger } from "./typer";

/**
 * ÉN kilde for prosjekt-referansen i utskrift (2026-08-12). Fallback-kjede vedtatt
 * i terminologi.md § Tre prosjektnumre:
 *   eksternt (utskrift-toggle på + satt) → internt (satt) → SD (siste utvei, gated
 *   av visSiteDocNummer) → "".
 * SD er sikkerhetsnettet, ikke standardvalget — et byggherre-dokument skal aldri stå
 * helt uten referanse. web-utskriftssidene og PrintHeader kaller ALLE denne
 * — ikke reimplementer (fire divergente kopier var utgangspunktet).
 */
export function prosjektReferanseForUtskrift(
  prosjekt: ProsjektForPdf | null | undefined,
  innstillinger: Utskriftsinnstillinger | null | undefined,
): string {
  const eksternPå = innstillinger?.eksternProsjektnummer ?? true;
  if (eksternPå && prosjekt?.externalProjectNumber) return prosjekt.externalProjectNumber;
  if (prosjekt?.internalProjectNumber) return prosjekt.internalProjectNumber;
  if (prosjekt?.visSiteDocNummer ?? true) return prosjekt?.projectNumber ?? "";
  return "";
}
