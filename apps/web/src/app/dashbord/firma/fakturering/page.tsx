"use client";

import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Spinner } from "@sitedoc/ui";
import { HardDrive } from "lucide-react";
import { formaterBytes } from "@sitedoc/shared";
import { SonetonetSidehode } from "@/components/layout/SonetonetSidehode";
import { useFirma } from "@/kontekst/firma-kontekst";

/**
 * Firma-admin lagrings-/faktureringsflate (2026-08-11). Eget firma
 * (primaryOrganizationId = eierskap), per prosjekt + totaltall filer. Kunden som
 * betaler lagringsbasert arkivpris skal se tallet løpende — ingen overraskelse,
 * og kan rydde selv. Foreldreløse/standalone vises IKKE her (ikke firmaets).
 */
export default function FirmaFakturering() {
  const { t } = useTranslation();
  const { valgtFirma } = useFirma();
  const orgId = valgtFirma?.id;

  const { data, isLoading } = trpc.lagring.firmaOversikt.useQuery(
    { organizationId: orgId! },
    { enabled: !!orgId },
  );

  return (
    <div>
      <SonetonetSidehode sone="firma" className="mb-4">
        <h1 className="text-lg font-semibold text-gray-900">{t("firma.lagring.tittel")}</h1>
      </SonetonetSidehode>

      <p className="mb-4 text-sm text-gray-600">{t("firma.lagring.beskrivelse")}</p>

      {!orgId ? (
        <p className="text-sm text-gray-500">{t("firma.velgFirma")}</p>
      ) : isLoading ? (
        <div className="flex justify-center p-10">
          <Spinner />
        </div>
      ) : !data ? (
        <p className="text-sm text-gray-500">{t("firma.lagring.ingen")}</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3">
              <HardDrive className="h-6 w-6 text-sitedoc-primary" />
              <div>
                <div className="text-xs font-medium text-gray-500">{t("firma.lagring.total")}</div>
                <div className="text-lg font-semibold text-gray-900">{formaterBytes(data.totalBytes)}</div>
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="text-xs font-medium text-gray-500">{t("firma.lagring.antallFiler")}</div>
              <div className="text-lg font-semibold text-gray-900">{data.totalAntall}</div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="text-xs font-medium text-gray-500">{t("firma.lagring.dbVolum")}</div>
              <div className="text-lg font-semibold text-gray-900">{formaterBytes(data.dbVolumEstimatBytes)}</div>
              <div className="text-[11px] text-gray-400">{t("firma.lagring.dbVolumNote")}</div>
            </div>
          </div>

          {data.prosjekter.length === 0 ? (
            <p className="mt-6 text-sm text-gray-500">{t("firma.lagring.ingen")}</p>
          ) : (
            <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
                    <th className="px-3 py-2">{t("firma.lagring.prosjekt")}</th>
                    <th className="px-3 py-2 text-right">{t("firma.lagring.lagring")}</th>
                    <th className="px-3 py-2 text-right">{t("firma.lagring.filer")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.prosjekter.map((p) => (
                    <tr key={p.projectId} className="border-b border-gray-50 last:border-0">
                      <td className="px-3 py-2 text-gray-800">
                        {p.prosjektNavn ?? p.projectId}
                        {p.prosjektNummer ? <span className="text-gray-400"> ({p.prosjektNummer})</span> : null}
                      </td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums text-gray-900">
                        {formaterBytes(p.totalBytes)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-500">{p.totalAntall}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.manglerStorrelseAntall > 0 && (
            <p className="mt-3 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-800">
              {t("firma.lagring.manglerStorrelse", { antall: data.manglerStorrelseAntall })}
            </p>
          )}

          <p className="mt-3 text-xs text-gray-400">
            {t("firma.lagring.generert", { tid: new Date(data.generertVed).toLocaleString("nb-NO") })}
          </p>
        </>
      )}
    </div>
  );
}
