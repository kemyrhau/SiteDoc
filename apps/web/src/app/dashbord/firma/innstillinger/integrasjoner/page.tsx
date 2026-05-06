"use client";

import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Card, Spinner } from "@sitedoc/ui";
import { useFirma } from "@/kontekst/firma-kontekst";

export default function FirmaIntegrasjonerSide() {
  const { t } = useTranslation();
  const { valgtFirma } = useFirma();
  const orgId = valgtFirma?.id;

  const { data: integrasjoner, isLoading } = trpc.firmaIntegrasjon.list.useQuery(
    { organizationId: orgId! },
    { enabled: !!orgId },
  );

  if (!orgId) {
    return (
      <main className="flex-1 overflow-auto bg-gray-50 p-6">
        <p className="text-sm text-gray-500">
          {t("firma.integrasjoner.velgFirma")}
        </p>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-auto bg-gray-50 p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">
          {t("firma.integrasjoner.tittel")}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {t("firma.integrasjoner.beskrivelse")}
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : (
        <Card>
          <p className="text-sm text-gray-600">
            {t("firma.integrasjoner.ingenAktive")}
          </p>
          {integrasjoner && integrasjoner.length > 0 && (
            <ul className="mt-4 space-y-2 text-sm text-gray-700">
              {integrasjoner.map((i) => (
                <li key={i.id} className="flex items-center justify-between border-t border-gray-100 pt-2">
                  <span className="font-medium">{i.type}</span>
                  <span className="text-xs text-gray-500">
                    {i.harNøkkel ? t("firma.integrasjoner.koblet") : t("firma.integrasjoner.ikkeKoblet")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </main>
  );
}
