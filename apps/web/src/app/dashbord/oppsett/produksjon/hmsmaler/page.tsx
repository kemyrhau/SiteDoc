"use client";

import { MalListe } from "../_components/MalListe";
import { useTranslation } from "react-i18next";
import { HjelpKnapp, HjelpFane } from "@/components/hjelp/HjelpModal";
import { useToppbarFiltre } from "@/hooks/useToppbarFiltre";

export default function HmsmalerSide() {
  useToppbarFiltre({ byggeplass: false });
  const { t } = useTranslation();
  return (
    <MalListe
      kategori="hms"
      tittel={t("oppsett.hmsmaler")}
      opprettTekst={t("maler.nyHmsmal")}
      tomTittel={t("maler.ingenHmsmaler")}
      tomBeskrivelse={t("maler.ingenHmsmalBeskrivelse")}
      hjelpInnhold={
        <HjelpKnapp>
          <HjelpFane tittel={t("hjelp.hmsmaler.hvaTittel")}>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">{t("hjelp.hmsmaler.hva")}</p>
              <div className="rounded-lg border border-blue-100 bg-blue-50/50 px-4 py-3">
                <p className="text-sm font-medium text-blue-800">{t("hjelp.hmsmaler.tipsTittel")}</p>
                <p className="mt-1 text-sm text-blue-700">{t("hjelp.hmsmaler.tips")}</p>
              </div>
            </div>
          </HjelpFane>
        </HjelpKnapp>
      }
    />
  );
}
