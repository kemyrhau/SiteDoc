"use client";

import { MalListe } from "../_components/MalListe";
import { useTranslation } from "react-i18next";

export default function SjekklistemalerSide() {
  const { t } = useTranslation();
  return (
    <MalListe
      kategori="sjekkliste"
      tittel={t("oppsett.sjekklistemaler")}
      opprettTekst={t("maler.nySjekklistemal")}
      tomTittel={t("maler.ingenSjekklistemaler")}
      tomBeskrivelse={t("maler.ingenSjekklstemalBeskrivelse")}
    />
  );
}
