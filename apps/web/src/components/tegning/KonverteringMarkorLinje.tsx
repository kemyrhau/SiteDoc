"use client";

import { useTranslation } from "react-i18next";
import { FileCog, Loader2 } from "lucide-react";
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
 *
 * `visning="ikon"` (topplinja i tegningsviseren, VERKTOYLINJE-IKONER 2026-11-25): samme
 * tekst, men som ett ikon med teksten i title + aria-label. Standard er tekst (modalen).
 */
export function KonverteringMarkorLinje({
  markor,
  erKonvertert,
  konverterer,
  visning = "tekst",
}: {
  markor: KonverteringMarkor | null;
  erKonvertert: boolean;
  /** Konvertering pågår (pending/converting): vis «Konverterer …», ALDRI den gamle
   * markøren — den ville vist forrige revisjons versjon som falsk informasjon. */
  konverterer?: boolean;
  visning?: "tekst" | "ikon";
}) {
  const { t } = useTranslation();

  function vis(tekst: string, ikon: JSX.Element) {
    if (visning === "ikon") {
      return (
        <span role="img" className="p-1 text-gray-400" title={tekst} aria-label={tekst}>
          {ikon}
        </span>
      );
    }
    return <span className="text-xs text-gray-400">{tekst}</span>;
  }

  if (konverterer) {
    return vis(t("tegninger.konverterer"), <Loader2 className="h-4 w-4 animate-spin" />);
  }

  if (markor) {
    const tid = formaterKonvertertTid(markor.konvertertTid);
    const tekst =
      markor.kodeversjon === "ukjent"
        ? t("tegninger.markor.konvertertUkjent", { tid })
        : t("tegninger.markor.konvertert", { tid, versjon: kortKodeversjon(markor.kodeversjon) });
    return vis(tekst, <FileCog className="h-4 w-4" />);
  }

  if (erKonvertert) {
    return vis(t("tegninger.markor.foerMerking"), <FileCog className="h-4 w-4" />);
  }

  return null;
}
