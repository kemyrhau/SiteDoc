"use client";

import { MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * ORDRE (20) linja (2026-11-15): amber linje «Byggeplass ikke valgt · Velg» på dokument-detaljsider.
 * Kalleren avgjør synlighet med `visByggeplassIkkeValgt` (@sitedoc/shared) og hva «Velg» åpner
 * (sjekkliste: byggeplass-chipen; oppgave: lokasjonsvelgeren).
 */
export function ByggeplassIkkeValgtLinje({ onVelg }: { onVelg: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      data-testid="byggeplass-ikke-valgt"
      title={t("kontekstChip.byggeplassIkkeValgtHjelp")}
      className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm text-amber-800"
    >
      <MapPin className="h-4 w-4 shrink-0 text-amber-500" />
      <span>{t("kontekstChip.byggeplassIkkeValgt")}</span>
      <span aria-hidden className="text-amber-400">·</span>
      <button
        type="button"
        onClick={onVelg}
        className="rounded px-1 font-medium text-amber-900 underline-offset-2 hover:underline"
      >
        {t("handling.velg")}
      </button>
    </div>
  );
}
