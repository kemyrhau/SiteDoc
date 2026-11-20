"use client";

// w10b: detaljen til den ene attesteringen (flyttet fra /dashbord/firma/timer/attestering/[id]).
// Firma-admin attesterer på tvers av prosjekter som før; prosjektlederen bare på sine
// prosjekter (`kanAttestereFirma.prosjektIder` → `prosjektKontekst`). Serveren håndhever det
// samme i hentForAttestering + attesterRader.

import { useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Spinner } from "@sitedoc/ui";
import { useAttesteringsFirma } from "@/components/attestering/useAttesteringsFirma";
import { AttesteringDetalj } from "@/components/timer/AttesteringDetalj";

export default function AttesteringDetaljSide() {
  const { t } = useTranslation();
  const { orgId: valgtOrgId, laster: firmaLaster } = useAttesteringsFirma();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const orgId = valgtOrgId ?? undefined;

  // Retur-URL (2026-08-23): gjenopprett oversiktens visning/uke/fane fra EKSPLISITTE
  // ?fraVisning/fraUke/fraFane-verdier (lukket sett — ingen vilkårlig URL å validere, unngår
  // open-redirect). Ugyldig/utelatt verdi faller til standard; ingen fra-parametre → bar base-URL.
  const BASE = "/dashbord/attestering";
  const fraVisning = searchParams.get("fraVisning");
  const fraUke = searchParams.get("fraUke");
  const fraFane = searchParams.get("fraFane");
  const harReturkontekst = fraVisning !== null || fraUke !== null || fraFane !== null;
  const visning =
    fraVisning === "prosjekt" || fraVisning === "ansatt" ? fraVisning : "sedler";
  const uke = Number.isInteger(Number(fraUke)) ? Number(fraUke) : 0;
  const fane = fraFane === "accepted" ? "accepted" : "sent";
  const firmaParam = searchParams.get("firma");
  const firmaQs = firmaParam && firmaParam === orgId ? `firma=${encodeURIComponent(firmaParam)}` : "";
  const tilbakeUrl = harReturkontekst
    ? `${BASE}?visning=${visning}&uke=${uke}&fane=${fane}${firmaQs ? `&${firmaQs}` : ""}`
    : firmaQs
      ? `${BASE}?${firmaQs}`
      : BASE;

  const { data: tilgang, isLoading: tilgangLaster } =
    trpc.timer.dagsseddel.kanAttestereFirma.useQuery(
      { organizationId: orgId! },
      { enabled: !!orgId },
    );
  const prosjektKontekst = useMemo(
    () => (tilgang?.omfang === "prosjekter" ? new Set(tilgang.prosjektIder) : undefined),
    [tilgang],
  );

  if (firmaLaster || tilgangLaster) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!orgId || !tilgang || tilgang.omfang === "ingen") {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertCircle className="mr-1 inline-block h-4 w-4" />
          {t("timer.attestering.ingenTilgangFirma")}
        </div>
      </div>
    );
  }

  return (
    <AttesteringDetalj
      sheetId={params.id}
      prosjektKontekst={prosjektKontekst}
      tilbakeUrl={tilbakeUrl}
    />
  );
}
