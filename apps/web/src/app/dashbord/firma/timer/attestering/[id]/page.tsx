"use client";

// T7-2b1 (2026-05-14): firma-admin-detalj for attestering. Monteringen er
// projectId-løs — firma-admin kan attestere rader på tvers av prosjekter
// (gated på autoriserAdminForFirma i hentForAttestering + attesterRader).

import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Spinner } from "@sitedoc/ui";
import { useFirma } from "@/kontekst/firma-kontekst";
import { AttesteringDetalj } from "@/components/timer/AttesteringDetalj";

export default function AttesteringDetaljFirmaSide() {
  const { t } = useTranslation();
  const { valgtFirma } = useFirma();
  const params = useParams<{ id: string }>();
  const orgId = valgtFirma?.id;

  const { data: kanAttestere, isLoading: tilgangLaster } =
    trpc.timer.dagsseddel.kanAttestereFirma.useQuery(
      { organizationId: orgId! },
      { enabled: !!orgId },
    );

  if (!orgId) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertCircle className="mr-1 inline-block h-4 w-4" />
          {t("firma.timer.attesteringIngenFirma")}
        </div>
      </div>
    );
  }

  if (tilgangLaster) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (kanAttestere?.kanAttestere === false) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertCircle className="mr-1 inline-block h-4 w-4" />
          {t("timer.attestering.ingenTilgang")}
        </div>
      </div>
    );
  }

  return (
    <AttesteringDetalj
      sheetId={params.id}
      tilbakeUrl="/dashbord/firma/timer/attestering"
    />
  );
}
