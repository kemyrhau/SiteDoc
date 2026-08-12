"use client";

import { useTranslation } from "react-i18next";
import { Power } from "lucide-react";
import { Tooltip } from "@sitedoc/ui";

/**
 * Delt deaktiver-/aktiver-knapp (2026-08-12). `Power` (lucide) er deaktiver-ikonet
 * i hele SiteDoc — aldri `Trash2` (sletting ≠ deaktivering). Tooltip via
 * `@sitedoc/ui` (ingen `title=` — den har ~1 s browserstyrt forsinkelse).
 *
 * 🔴 Tooltipen sier KONSEKVENSEN, ikke handlingen (mikrotekst-standard § 3): svar på
 * «hva mister jeg» — «skjules for nye registreringer, eksisterende beholder den».
 * Uten det siste leddet tør ingen trykke. Standardtekstene passer timer-katalog
 * (lønnsart/aktivitet/tillegg/utleggskategori); overstyr `tekst*` ved behov.
 */
export function DeaktiverKnapp({
  aktiv,
  pending,
  onClick,
  tekstDeaktiver,
  tekstAktiver,
}: {
  aktiv: boolean;
  pending?: boolean;
  onClick: () => void;
  /** Tooltip når raden er aktiv (knappen deaktiverer). Default = konsekvenstekst. */
  tekstDeaktiver?: string;
  /** Tooltip når raden er inaktiv (knappen aktiverer). */
  tekstAktiver?: string;
}) {
  const { t } = useTranslation();
  const tekst = aktiv
    ? tekstDeaktiver ?? t("deaktiver.tooltip.deaktiver")
    : tekstAktiver ?? t("deaktiver.tooltip.aktiver");

  return (
    <Tooltip tekst={tekst} side="left">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-label={aktiv ? t("deaktiver.handling.deaktiver") : t("deaktiver.handling.aktiver")}
        className={`rounded p-1.5 transition-colors disabled:opacity-40 ${
          aktiv
            ? "text-gray-500 hover:bg-red-50 hover:text-red-600"
            : "text-gray-400 hover:bg-emerald-50 hover:text-emerald-600"
        }`}
      >
        <Power className="h-4 w-4" />
      </button>
    </Tooltip>
  );
}
