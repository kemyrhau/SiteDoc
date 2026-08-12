"use client";

import { useTranslation } from "react-i18next";

/**
 * Minimal «Inaktiv»-badge (2026-08-12). `opacity-50` alene leses som «laster» /
 * «utilgjengelig» — en eksplisitt badge sier at raden er bevisst deaktivert.
 *
 * BEVISST ikke `@sitedoc/ui` StatusBadge: den bærer DOKUMENT-status-semantikk
 * (draft/sent/godkjent). «Inaktiv» er en annen akse (katalog-tilgjengelighet) og
 * skal ikke smitte inn i dokumentstatus-komponenten.
 */
export function InaktivBadge() {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
      {t("deaktiver.inaktiv")}
    </span>
  );
}
