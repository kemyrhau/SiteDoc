"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Button, Spinner } from "@sitedoc/ui";
import { CheckCircle2, AlertCircle, Package } from "lucide-react";
import { useFirma } from "@/kontekst/firma-kontekst";

export default function TimerOnboardingSide() {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const { valgtFirma } = useFirma();
  const orgId = valgtFirma?.id;
  const [feil, setFeil] = useState<string | null>(null);

  const { data: status, isLoading } = trpc.timer.onboarding.status.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId },
  );

  const aktiverNivaa1 = trpc.timer.onboarding.aktiverNivaa1.useMutation({
    onSuccess: () => {
      utils.timer.onboarding.status.invalidate();
      utils.organisasjon.hentMin.invalidate();
    },
    onError: (e) => setFeil(e.message),
  });

  const aktiverNivaa2 = trpc.timer.onboarding.aktiverNivaa2.useMutation({
    onSuccess: () => {
      utils.timer.onboarding.status.invalidate();
      utils.timer.lonnsart.list.invalidate();
    },
    onError: (e) => setFeil(e.message),
  });

  const aktiverTomKatalog = trpc.timer.onboarding.aktiverTomKatalog.useMutation({
    onSuccess: () => {
      utils.timer.onboarding.status.invalidate();
      utils.organisasjon.hentMin.invalidate();
    },
    onError: (e) => setFeil(e.message),
  });

  if (isLoading || !status) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!status.harTimerModul) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">
            {t("firma.timer.onboarding.aktiverTittel")}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {t("firma.timer.onboarding.aktiverBeskrivelse")}
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-gray-200 p-5">
              <div className="mb-2 flex items-center gap-2">
                <Package className="h-5 w-5 text-sitedoc-primary" />
                <h3 className="text-base font-semibold text-gray-900">
                  {t("firma.timer.onboarding.scenarioA")}
                </h3>
              </div>
              <p className="text-sm text-gray-600">
                {t("firma.timer.onboarding.scenarioABeskrivelse")}
              </p>
              <ul className="mt-3 space-y-1 text-xs text-gray-600">
                <li>• {t("firma.timer.onboarding.inkluderer.nivaa1")}</li>
                <li>• {t("firma.timer.onboarding.inkluderer.aktiviteter")}</li>
                <li>• {t("firma.timer.onboarding.inkluderer.tillegg")}</li>
                <li>• {t("firma.timer.onboarding.inkluderer.expense")}</li>
              </ul>
              <div className="mt-4 flex flex-col gap-2">
                <Button
                  onClick={() => {
                    setFeil(null);
                    aktiverNivaa1.mutate({ inkluderNivaa2: false, organizationId: orgId });
                  }}
                  disabled={aktiverNivaa1.isPending}
                >
                  {aktiverNivaa1.isPending
                    ? t("handling.lagrer")
                    : t("firma.timer.onboarding.aktiverNivaa1")}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setFeil(null);
                    aktiverNivaa1.mutate({ inkluderNivaa2: true, organizationId: orgId });
                  }}
                  disabled={aktiverNivaa1.isPending}
                >
                  {t("firma.timer.onboarding.aktiverNivaa1Og2")}
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-5">
              <div className="mb-2 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                <h3 className="text-base font-semibold text-gray-900">
                  {t("firma.timer.onboarding.scenarioB")}
                </h3>
              </div>
              <p className="text-sm text-gray-600">
                {t("firma.timer.onboarding.scenarioBBeskrivelse")}
              </p>
              <div className="mt-4">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setFeil(null);
                    aktiverTomKatalog.mutate({ organizationId: orgId });
                  }}
                  disabled={aktiverTomKatalog.isPending}
                >
                  {aktiverTomKatalog.isPending
                    ? t("handling.lagrer")
                    : t("firma.timer.onboarding.aktiverTom")}
                </Button>
              </div>
            </div>
          </div>

          {feil && (
            <p className="mt-4 text-sm text-red-600">{feil}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4">
        <CheckCircle2 className="h-5 w-5 text-green-600" />
        <span className="text-sm font-medium text-green-900">
          {t("firma.timer.onboarding.aktivertVarsel")}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KatalogKort
          tittel={t("firma.timer.fane.lonnsarter")}
          antall={status.antallLonnsartTotalt}
          undertekst={t("firma.timer.onboarding.lonnsartFordeling", {
            nivaa1: status.antallLonnsartNivaa1,
            nivaa2: status.antallLonnsartNivaa2,
            egendefinert: status.antallLonnsartEgendefinert,
          })}
        />
        <KatalogKort
          tittel={t("firma.timer.fane.aktiviteter")}
          antall={status.antallAktiviteter}
          undertekst=""
        />
        <KatalogKort
          tittel={t("firma.timer.fane.tillegg")}
          antall={status.antallTillegg}
          undertekst=""
        />
        <KatalogKort
          tittel={t("firma.timer.onboarding.expenseKategorier")}
          antall={status.antallExpenseKategorier}
          undertekst=""
        />
      </div>

      {status.antallLonnsartNivaa2 === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h3 className="text-base font-semibold text-gray-900">
            {t("firma.timer.onboarding.importNivaa2Tittel")}
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            {t("firma.timer.onboarding.importNivaa2Beskrivelse")}
          </p>
          <div className="mt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setFeil(null);
                aktiverNivaa2.mutate({ organizationId: orgId });
              }}
              disabled={aktiverNivaa2.isPending}
            >
              {aktiverNivaa2.isPending
                ? t("handling.lagrer")
                : t("firma.timer.onboarding.importNivaa2Knapp")}
            </Button>
          </div>
          {feil && <p className="mt-3 text-sm text-red-600">{feil}</p>}
        </div>
      )}
    </div>
  );
}

function KatalogKort({
  tittel,
  antall,
  undertekst,
}: {
  tittel: string;
  antall: number;
  undertekst: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {tittel}
      </p>
      <p className="mt-2 text-3xl font-semibold text-gray-900">{antall}</p>
      {undertekst && (
        <p className="mt-1 text-xs text-gray-500">{undertekst}</p>
      )}
    </div>
  );
}
