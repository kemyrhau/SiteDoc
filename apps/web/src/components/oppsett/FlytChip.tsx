"use client";

/**
 * FlytChip — flyt-first-chipen på kontaktsiden (Spor 1 v2.1, mockup-fasit).
 *
 * «Flyt →» + flytnavn + rolle i én sammenhengende pille. Leder kontakt-raden;
 * faggruppe beholder ALLTID sin egen form (fargeprikk-pille) — chipen her sier
 * aldri «Faggruppe». Rollen er allerede oversatt/label-resolvet av kalleren.
 */

import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";

export function FlytChip({ flytNavn, rolle }: { flytNavn: string; rolle: string }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex shrink-0 items-stretch overflow-hidden whitespace-nowrap rounded-md border border-violet-200 text-[11px] leading-tight">
      <span className="inline-flex items-center gap-0.5 bg-violet-600 px-1.5 py-0.5 font-bold text-white">
        {t("kontaktside.flytChip")}
        <ArrowRight className="h-2.5 w-2.5" />
      </span>
      <span className="bg-violet-50 px-1.5 py-0.5 font-semibold text-gray-800">{flytNavn}</span>
      <span className="bg-violet-100 px-1.5 py-0.5 font-semibold text-violet-700">{rolle}</span>
    </span>
  );
}
