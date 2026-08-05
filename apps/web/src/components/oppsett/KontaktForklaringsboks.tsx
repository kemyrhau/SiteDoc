"use client";

/**
 * KontaktForklaringsboks — to uavhengige linjer bundet til det kontaktlista viser.
 *
 * Erstatter SammenhengBoks-innholdet på Kontakter-siden (Spor 1 v2.1, mockup-fasit):
 * to separate ting styrer hva en kontakt kan — «Flyt» (deltakelse + rolle) og
 * «Gruppe» (tilgangsgruppe: moduler + domener). Ikke ett abstrakt kjede-diagram.
 *
 * Chip-etikett = «Gruppe» (kort); forklaringen bruker fullnavnet «tilgangsgruppe».
 */

import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";

export function KontaktForklaringsboks() {
  const { t } = useTranslation();

  return (
    <div className="mb-3 flex flex-col gap-2 rounded-lg border border-[#d4deee] bg-[#f4f7fc] px-3.5 py-3">
      <span className="text-xs font-bold text-sitedoc-primary">
        {t("kontaktside.forklaringTittel")}
      </span>

      {/* Flyt = hvem har ballen */}
      <div className="flex items-baseline gap-2 text-xs text-gray-600">
        <span className="inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
          {t("kontaktside.forklaringFlytBadge")}
          <ArrowRight className="h-2.5 w-2.5" />
        </span>
        <span>{t("kontaktside.forklaringFlyt")}</span>
      </div>

      {/* Gruppe = moduler/domener */}
      <div className="flex items-baseline gap-2 text-xs text-gray-600">
        <span className="inline-flex shrink-0 whitespace-nowrap rounded bg-slate-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
          {t("kontaktside.forklaringGruppeBadge")}
        </span>
        <span>{t("kontaktside.forklaringGruppe")}</span>
      </div>
    </div>
  );
}
