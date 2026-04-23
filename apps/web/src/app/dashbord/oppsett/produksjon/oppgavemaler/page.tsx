"use client";

import { MalListe } from "../_components/MalListe";
import { useTranslation } from "react-i18next";
import { HjelpKnapp, HjelpFane } from "@/components/hjelp/HjelpModal";

export default function OppgavemalerSide() {
  const { t } = useTranslation();
  return (
    <MalListe
      kategori="oppgave"
      tittel={t("oppsett.oppgavemaler")}
      opprettTekst={t("maler.nyOppgavemal")}
      tomTittel={t("maler.ingenOppgavemaler")}
      tomBeskrivelse={t("maler.ingenOppgavemalBeskrivelse")}
      hjelpInnhold={
        <HjelpKnapp>
          <HjelpFane tittel={t("hjelp.oppgavemaler.hvaTittel")}>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">{t("hjelp.oppgavemaler.hva")}</p>
              <div className="rounded-lg border border-blue-100 bg-blue-50/50 px-4 py-3">
                <p className="text-sm font-medium text-blue-800">{t("hjelp.oppgavemaler.tipsTittel")}</p>
                <p className="mt-1 text-sm text-blue-700">{t("hjelp.oppgavemaler.tips")}</p>
              </div>
            </div>
          </HjelpFane>
        </HjelpKnapp>
      }
    />
  );
}
