"use client";

import { MalListe } from "../_components/MalListe";
import { useTranslation } from "react-i18next";
import { HjelpKnapp, HjelpFane } from "@/components/hjelp/HjelpModal";

export default function SjekklistemalerSide() {
  const { t } = useTranslation();
  return (
    <MalListe
      kategori="sjekkliste"
      tittel={t("oppsett.sjekklistemaler")}
      opprettTekst={t("maler.nySjekklistemal")}
      tomTittel={t("maler.ingenSjekklistemaler")}
      tomBeskrivelse={t("maler.ingenSjekklstemalBeskrivelse")}
      hjelpInnhold={
        <HjelpKnapp>
          <HjelpFane tittel={t("hjelp.sjekklistemaler.hvaTittel")}>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">{t("hjelp.sjekklistemaler.hva")}</p>
              <div className="rounded-lg border border-blue-100 bg-blue-50/50 px-4 py-3">
                <p className="text-sm font-medium text-blue-800">{t("hjelp.sjekklistemaler.tipsTittel")}</p>
                <p className="mt-1 text-sm text-blue-700">{t("hjelp.sjekklistemaler.tips")}</p>
              </div>
            </div>
          </HjelpFane>
        </HjelpKnapp>
      }
    />
  );
}
