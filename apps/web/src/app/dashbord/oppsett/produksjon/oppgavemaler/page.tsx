"use client";

import { MalListe } from "../_components/MalListe";
import { useTranslation } from "react-i18next";

export default function OppgavemalerSide() {
  const { t } = useTranslation();
  return (
    <MalListe
      kategori="oppgave"
      tittel={t("oppsett.oppgavemaler")}
      opprettTekst={t("maler.nyOppgavemal")}
      tomTittel={t("maler.ingenOppgavemaler")}
      tomBeskrivelse={t("maler.ingenOppgavemalBeskrivelse")}
    />
  );
}
