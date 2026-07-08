"use client";

/**
 * Delt gating-hook for prosjekt-produksjons-tilgang (manage_field).
 *
 * Ekstrahert verbatim ut av `lib/innstillinger-kort.tsx` slik at flere
 * konsumenter (innstillinger-huben + Mapper-sidens «Administrer mapper»-inngang)
 * leser samme gating uten duplisert logikk.
 *
 * Speiler oppsett-sidebarens admin/registrator-bypass: sitedoc_admin/company_admin
 * + prosjekt-admin/registrator (flytErAdmin) ser produksjons-kortene selv uten
 * eksplisitt manage_field. sitedoc_admin/company_admin har typisk ingen
 * ProjectMember-tillatelse → falt utenfor før.
 */

import { useFirma } from "@/kontekst/firma-kontekst";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { trpc } from "@/lib/trpc";

export function useKanManageField(): boolean {
  const { erSitedocAdmin, erCompanyAdmin } = useFirma();
  const { prosjektId } = useProsjekt();

  const { data: tillatelser } = trpc.gruppe.hentMineTillatelser.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );
  const { data: minFlytInfo } = trpc.gruppe.hentMinFlytInfo.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );
  const flytErAdmin = (minFlytInfo as { erAdmin?: boolean } | undefined)?.erAdmin ?? false;

  return (
    erSitedocAdmin || erCompanyAdmin || flytErAdmin || !!tillatelser?.includes("manage_field")
  );
}
