"use client";

// V20-W / TILLEGG 2 (2026-10-07) — matpause-avkrysningen på attestant-raden,
// SKRIVEBESKYTTET. Attesteringsvisningen (SeddelKort + attestering-buckets)
// viste ikke at pausen var trukket; arbeiderens dagsseddel gjør det (rad-lista
// i timer/[id]/page.tsx). Dette gir paritet: leder/attestant ser at bæreren
// bærer matpausen.
//
// 🔴 Ærlighet (stille-tomhet): rendrer KUN for bæreren (rad.pauseMin > 0). Andre
// rader viser ingenting her — attestantflaten har ikke dagens pausevindu-kontekst
// (standardPauseMin/pauseFra pr. firma), og en tom avkrysning uten den konteksten
// ville vært en gjetning. Bæreren er den eneste honnøre påstanden vi kan stå for:
// «denne raden har N min matpause trukket». Ingen interaksjon — attestanten
// redigerer pausen via rad-redigering (RedigerRadModal), aldri her.

import { useTranslation } from "react-i18next";
import { CheckSquare } from "lucide-react";
import type { TimerRad } from "./attestering-buckets";

export function MatpauseRadMerke({ rad }: { rad: TimerRad }) {
  const { t } = useTranslation();
  const pauseMin = typeof rad.pauseMin === "number" ? rad.pauseMin : 0;
  if (pauseMin <= 0) return null;
  return (
    <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
      <CheckSquare className="h-3.5 w-3.5 shrink-0 text-sitedoc-primary" />
      {t("timer.matpause.trukket", { min: pauseMin })}
    </p>
  );
}
