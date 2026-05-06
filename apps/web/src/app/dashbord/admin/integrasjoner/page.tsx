"use client";

import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Card, Spinner } from "@sitedoc/ui";
import { Check, X, Globe, Shield } from "lucide-react";

export default function AdminIntegrasjonerSide() {
  const { t } = useTranslation();
  const { data, isLoading } = trpc.admin.hentPlatformIntegrasjoner.useQuery();

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">
          {t("admin.integrasjoner.tittel")}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {t("admin.integrasjoner.beskrivelse")}
        </p>
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          {t("admin.integrasjoner.platformTittel")}
        </h2>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <PlatformKort
              ikon={<Globe className="h-5 w-5 text-blue-700" />}
              tittel={t("admin.integrasjoner.vegvesen.tittel")}
              beskrivelse={
                data?.vegvesen.beskrivelse ??
                t("admin.integrasjoner.vegvesen.beskrivelse")
              }
              konfigurert={!!data?.vegvesen.konfigurert}
              hint={t("admin.integrasjoner.envHint", { variabel: "VEGVESEN_API_KEY" })}
            />
            <PlatformKort
              ikon={<Shield className="h-5 w-5 text-amber-700" />}
              tittel={t("admin.integrasjoner.kryptering.tittel")}
              beskrivelse={
                data?.krypteringsnoekkel.beskrivelse ??
                t("admin.integrasjoner.kryptering.beskrivelse")
              }
              konfigurert={!!data?.krypteringsnoekkel.konfigurert}
              hint={t("admin.integrasjoner.envHint", { variabel: "SITEDOC_INTEGRATION_KEY" })}
            />
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          {t("admin.integrasjoner.firmaTittel")}
        </h2>
        <Card>
          <p className="text-sm text-gray-600">
            {t("admin.integrasjoner.firmaBeskrivelse")}
          </p>
        </Card>
      </section>
    </>
  );
}

function PlatformKort({
  ikon,
  tittel,
  beskrivelse,
  konfigurert,
  hint,
}: {
  ikon: JSX.Element;
  tittel: string;
  beskrivelse: string;
  konfigurert: boolean;
  hint: string;
}) {
  const { t } = useTranslation();
  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
          {ikon}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900">{tittel}</h3>
            {konfigurert ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                <Check className="h-3 w-3" />
                {t("admin.integrasjoner.konfigurert")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                <X className="h-3 w-3" />
                {t("admin.integrasjoner.ikkeKonfigurert")}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-500">{beskrivelse}</p>
          <p className="mt-2 font-mono text-xs text-gray-400">{hint}</p>
        </div>
      </div>
    </Card>
  );
}
