/**
 * F13c beslutning 1A (Kenneth 2026-11-23): legges oppretteren inn i prosjektet?
 *
 * Oppretter du et prosjekt for ditt eget firma (aktiv ansettelse der), blir du
 * prosjektadmin og kobles til Byggherre som før. Oppretter du for et annet firma
 * — i praksis sitedoc_admin på vegne av en kunde — blir du verken medlem, admin
 * eller lagt i en faggruppe. sitedoc_admin setter opp prosjektet etterpå via
 * bypassen i `verifiserAdmin`/`verifiserProsjektmedlem`, uten medlemskap.
 *
 * Prosjekt uten firma (organizationId = null) regnes som eget: oppretteren legges inn.
 */
import { erAnsattIFirma } from "../trpc/tilgangskontroll";

export async function skalOppretterBliMedlem(
  userId: string,
  organizationId: string | null,
): Promise<boolean> {
  if (!organizationId) return true;
  return erAnsattIFirma(userId, organizationId);
}
