"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Spinner } from "@sitedoc/ui";
import { useFirma } from "@/kontekst/firma-kontekst";
import { IngenFirmaValgt } from "@/components/firma/IngenFirmaValgt";
import {
  MALFORVALTNING_FANER,
  gateMalforvaltningFaner,
  type MalforvaltningFaneId,
} from "@/lib/malforvaltning-tilgang";
import { SitedocArkivFane } from "./_components/SitedocArkivFane";
import { FirmaarkivFane } from "./_components/FirmaarkivFane";

/**
 * Malforvaltning (ordre malforvaltning, Kenneth 15.09) — forvaltnings-flaten for firma- og
 * SiteDoc-maler, under firmainnstillingene. Lese ≠ redigere: prosjektbruker/-admin ser den
 * ALDRI (de leser/henter fra arkivene inne i malbyggeren). Gatingen ligger i den rene
 * `gateMalforvaltningFaner` — hele flaten er synlig kun hvis minst én fane er det.
 *
 * PR 2: Firmaarkiv-fanen (én liste + maltype-filter, flyttet fra det revne
 * `/dashbord/firma/malarkiv`) + SiteDoc-arkiv-fanen (flyttet fra `/dashbord/admin/bibliotek`
 * i PR 1). Firmaarkiv vises for firma-admin, SiteDoc for sitedoc-admin. Papirkurv-fanen
 * kommer i en egen skjemarunde. Ingen tom/placeholder-fane bygges.
 */
export default function MalforvaltningSide() {
  const { t } = useTranslation();
  const { valgtFirma, isLoading, kanAdministrereFirma, erSitedocAdmin } = useFirma();

  const synligeFaner = gateMalforvaltningFaner(MALFORVALTNING_FANER, {
    kanAdministrereFirma,
    erSitedocAdmin,
  });
  const [aktivFane, setAktivFane] = useState<MalforvaltningFaneId | null>(
    synligeFaner[0]?.id ?? null,
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }
  if (!valgtFirma) return <IngenFirmaValgt tekst={t("firma.innstillinger.ingenFirma")} />;

  // Ingen synlig fane → ingen tilgang (prosjektadmin/-bruker skal aldri se flaten).
  if (synligeFaner.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-gray-500">
        {t("malforvaltning.ingenTilgang")}
      </p>
    );
  }

  const valgt = aktivFane ?? synligeFaner[0]!.id;

  return (
    <div className="flex h-full flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">{t("malforvaltning.tittel")}</h1>
        <p className="text-sm text-gray-500">{t("malforvaltning.undertittel")}</p>
      </div>

      {/* Nivåfaner: Firmaarkiv (firma-admin) og SiteDoc-arkiv (sitedoc-admin). */}
      <div className="flex gap-1 border-b border-gray-200">
        {synligeFaner.map((f) => (
          <button
            key={f.id}
            onClick={() => setAktivFane(f.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              valgt === f.id
                ? "border-sitedoc-primary text-sitedoc-primary"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {t(f.labelKey)}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1">
        {valgt === "firmaarkiv" && <FirmaarkivFane organizationId={valgtFirma.id} />}
        {valgt === "sitedoc" && <SitedocArkivFane />}
      </div>
    </div>
  );
}
