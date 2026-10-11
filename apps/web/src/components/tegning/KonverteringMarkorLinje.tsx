"use client";

import { useTranslation } from "react-i18next";
import {
  type KonverteringMarkor,
  formaterKonvertertTid,
  kortKodeversjon,
} from "@/lib/konverteringMarkor";

/**
 * Stille metadata-linje: hvilken kode som sist konverterte tegningen (2026-10-11).
 * «Konvertert 11.10 10:45 · versjon 2034396e». Ingen markør + tegningen ER konvertert
 * (eldre, før versjonsmerking) → «Konvertert før versjonsmerking». Ellers (ren
 * bildeopplasting, aldri konvertert) → ingenting. Ingen knapp, renest mulig UI.
 */
export function KonverteringMarkorLinje({
  markor,
  erKonvertert,
}: {
  markor: KonverteringMarkor | null;
  erKonvertert: boolean;
}) {
  const { t } = useTranslation();

  if (markor) {
    const tid = formaterKonvertertTid(markor.konvertertTid);
    const tekst =
      markor.kodeversjon === "ukjent"
        ? t("tegninger.markor.konvertertUkjent", { tid })
        : t("tegninger.markor.konvertert", { tid, versjon: kortKodeversjon(markor.kodeversjon) });
    return <span className="text-xs text-gray-400">{tekst}</span>;
  }

  if (erKonvertert) {
    return <span className="text-xs text-gray-400">{t("tegninger.markor.foerMerking")}</span>;
  }

  return null;
}
