"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { Spinner, EmptyState } from "@sitedoc/ui";
import { Building2, Pencil } from "lucide-react";
import { useToppbarFiltre } from "@/hooks/useToppbarFiltre";
import { HUB_LENKER } from "@/lib/hub-ruter";

export default function EierFirma() {
  useToppbarFiltre({ byggeplass: false });
  const { t } = useTranslation();
  const { prosjektId } = useProsjekt();
  const { data: organisasjon, isLoading } = trpc.organisasjon.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  if (!organisasjon) {
    return (
      <EmptyState
        title={t("oppsett.eierFirma.ingenFirmaTittel")}
        description={t("oppsett.eierFirma.ingenFirmaBeskrivelse")}
      />
    );
  }

  // Gaten er den tidlige returen på `!organisasjon` over: siden rendres kun når
  // prosjektet har et eier-firma — samme betingelse som `!!prosjektFirma` i
  // innstillinger-kort.tsx:78. Lenken gir ingen skrivevei; Firmaprofil har egen
  // firmaadmin-vakt på serveren.
  //
  // Bevisst forskjell fra hub-kortet (`|| erSitedocAdmin`): en sitedoc-admin på et
  // prosjekt UTEN eier-firma får EmptyState og ingen lenke her, mens hub-kortet ville
  // vist den. Riktig — siden har ingenting å vise om et firma som ikke finnes, og
  // standalone prosjekt (organizationId = null) er en gyldig permanent tilstand.
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">
          {t("oppsett.firmainnstillinger")}
        </h1>
        <Link
          href={HUB_LENKER.firmainfo}
          className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Pencil className="mr-1.5 h-4 w-4" />
          {t("oppsett.eierFirma.rediger")}
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
            <Building2 className="h-5 w-5 text-purple-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">{organisasjon.name}</h2>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          <div>
            <p className="text-sm text-gray-500">{t("oppsett.eierFirma.orgNr")}</p>
            <p className="font-medium text-gray-900">
              {organisasjon.organizationNumber || t("oppsett.eierFirma.ikkeSatt")}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-500">{t("oppsett.eierFirma.fakturaEpost")}</p>
            <p className="font-medium text-gray-900">
              {organisasjon.invoiceEmail || t("oppsett.eierFirma.ikkeSatt")}
            </p>
          </div>

          <div className="col-span-2">
            <p className="text-sm text-gray-500">{t("oppsett.eierFirma.fakturaAdresse")}</p>
            <p className="font-medium text-gray-900">
              {organisasjon.invoiceAddress || t("oppsett.eierFirma.ikkeSatt")}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-500">{t("oppsett.eierFirma.ehf")}</p>
            <p className="font-medium text-gray-900">
              {organisasjon.ehfEnabled
                ? t("oppsett.eierFirma.aktivert")
                : t("oppsett.eierFirma.ikkeAktivert")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
