"use client";

// D2-attestantvarsel (ORDRE 2 STEG 3 ledd 2) — delt tallfestet avviksbadge.
// Én visning brukt av både AnsattPivot (norm-kolonne) og SeddelKort (Sedler-
// visningen), så varselet ser likt ut uansett fane. Regnestykket + retningen
// bor i @sitedoc/shared (beregnUkeAvvik/avvikRetning) — badgen er ren visning.

import { useTranslation } from "react-i18next";
import { TriangleAlert } from "lucide-react";
import { avvikRetning, type UkeAvvik } from "@sitedoc/shared";

/** «over norm» = beregnet overtid ikke ført; «ført under norm» = overtid ført
 *  mens uken er under norm. Tooltip viser de tre D2-tallene (norm/ord/overtid).
 *  Intet avvik → ingen badge. */
export function Avviksbadge({ avvik }: { avvik: UkeAvvik }) {
  const { t } = useTranslation();
  const retning = avvikRetning(avvik);
  if (!retning) return null;
  const tooltip = t("timer.attestering.pivot.avvikTooltip", {
    norm: avvik.norm.toFixed(1),
    ord: avvik.sumOrdinaert.toFixed(1),
    ot: avvik.sumOvertid.toFixed(1),
  });
  return (
    <span
      title={tooltip}
      className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200"
    >
      <TriangleAlert className="h-3 w-3 shrink-0" />
      {retning === "over"
        ? t("timer.attestering.pivot.avvikOver", {
            timer: avvik.avvikTimer.toFixed(1),
          })
        : t("timer.attestering.pivot.avvikUnder")}
    </span>
  );
}
