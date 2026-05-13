"use client";

// T7-2b1 (2026-05-14): tynn wrapper rundt AttesteringDetalj-felleskomponenten.
// Tidligere innhold (591 linjer) flyttet til apps/web/src/components/timer/AttesteringDetalj.tsx.

import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Spinner } from "@sitedoc/ui";
import { AttesteringDetalj } from "@/components/timer/AttesteringDetalj";

export default function AttesteringDetaljProsjektSide() {
  const { t } = useTranslation();
  const params = useParams<{ prosjektId: string; id: string }>();

  const { data: kanAttestere, isLoading: tilgangLaster } =
    trpc.timer.dagsseddel.kanAttestere.useQuery({
      projectId: params.prosjektId,
    });

  if (tilgangLaster) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (kanAttestere === false) {
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
      prosjektKontekst={params.prosjektId}
      tilbakeUrl={`/dashbord/${params.prosjektId}/timer/attestering`}
    />
  );
}
