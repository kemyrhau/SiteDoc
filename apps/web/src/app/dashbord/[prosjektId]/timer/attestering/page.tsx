"use client";

// Prosjektattesteringen (spec prosjektkort-kortid § 12.2 R13, ordre d2b-2): samme tabell
// som firmaet, låst til prosjektet. Linjer på andre prosjekter står nedtonet og kan ikke
// velges (T30); uten tilgang til det andre prosjektet heter de «Annet prosjekt» —
// serveren sender aldri navn eller nummer (hentTilAttestering, api.md).

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Spinner } from "@sitedoc/ui";
import { AlertCircle } from "lucide-react";
import { SonetonetSidehode } from "@/components/layout/SonetonetSidehode";
import { HjelpKnapp, HjelpFane } from "@/components/hjelp/HjelpModal";
import { AttesteringTabell } from "@/components/attestering/AttesteringTabell";
import { useAttesteringModell } from "@/components/attestering/useAttesteringModell";
import type { AttSedel } from "@/components/attestering/attestering-tabell";

type ProsjektSedel = AttSedel & { organizationId?: string };

export default function AttesteringSide() {
  const { t } = useTranslation();
  const params = useParams<{ prosjektId: string }>();

  const { data: kanAttestere, isLoading: tilgangLaster } =
    trpc.timer.dagsseddel.kanAttestere.useQuery({ projectId: params.prosjektId });

  const { data: raderRaw, isLoading } = trpc.timer.dagsseddel.hentTilAttestering.useQuery(
    { projectId: params.prosjektId },
    { enabled: kanAttestere === true },
  );

  // Katalogene (lønnsart, aktivitet, maskin) er firmaets: én tabell pr. firma.
  const prFirma = useMemo(() => {
    const m = new Map<string, ProsjektSedel[]>();
    for (const s of (raderRaw ?? []) as unknown as ProsjektSedel[]) {
      const org = s.organizationId ?? "";
      m.set(org, [...(m.get(org) ?? []), s]);
    }
    return [...m.entries()];
  }, [raderRaw]);

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
    <div className="min-w-0 p-6">
      <SonetonetSidehode sone="prosjekt" className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{t("timer.attestering.tittel")}</h1>
            <p className="mt-1 text-sm text-gray-600">{t("timer.attestering.beskrivelse")}</p>
          </div>
          <HjelpKnapp>
            <HjelpFane tittel={t("timer.attestering.tabell.hjelp.tittel")}>
              <p>{t("timer.attestering.prosjekt.hjelp.laast")}</p>
              <p className="mt-2">{t("timer.attestering.tabell.hjelp.struktur")}</p>
              <p className="mt-2">{t("timer.attestering.tabell.hjelp.dato")}</p>
              <p className="mt-2">{t("timer.attestering.tabell.hjelp.handlinger")}</p>
              <p className="mt-2">{t("timer.attestering.tabell.hjelp.merker")}</p>
              <p className="mt-2">{t("timer.attestering.tabell.hjelp.retting")}</p>
              <p className="mt-2">{t("timer.attestering.tabell.hjelp.registrering")}</p>
              <p className="mt-2">{t("timer.attestering.tabell.hjelp.verktoy")}</p>
              <p className="mt-2">{t("timer.attestering.tabell.hjelp.kvittering")}</p>
            </HjelpFane>
          </HjelpKnapp>
        </div>
      </SonetonetSidehode>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : prFirma.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <p className="text-sm text-gray-500">{t("timer.attestering.ingenSedler")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {prFirma.map(([orgId, sedler]) => (
            <FirmaTabell
              key={orgId}
              orgId={orgId}
              sedler={sedler}
              prosjektId={params.prosjektId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FirmaTabell({ orgId, sedler, prosjektId }: { orgId: string; sedler: ProsjektSedel[]; prosjektId: string }) {
  const dager = useAttesteringModell(orgId || undefined, sedler);
  return (
    <AttesteringTabell
      dager={dager}
      orgId={orgId}
      readOnly={false}
      verktoy={null}
      prosjektKontekst={prosjektId}
      sedelUrl={(id) => `/dashbord/${prosjektId}/timer/attestering/${id}`}
    />
  );
}
