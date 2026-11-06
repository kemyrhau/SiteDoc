"use client";

import { useTranslation } from "react-i18next";

export type VareValg = {
  id: string;
  navn: string;
  varenummer: string | null;
  enhet: string;
};

/**
 * Vare-nedtrekk «navn (varenummer) — enhet». Delt mellom vareforbruk-siden
 * under prosjektet og prosjektkortets «+ Vareforbruk» (L3) — samme markup.
 */
export function VareVelger({
  varer,
  value,
  onChange,
  disabled,
}: {
  varer: VareValg[] | undefined;
  value: string;
  onChange: (vareId: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:bg-gray-100"
    >
      <option value="">{t("vareforbruk.felt.varePlaceholder")}</option>
      {varer?.map((v) => (
        <option key={v.id} value={v.id}>
          {v.navn}
          {v.varenummer ? ` (${v.varenummer})` : ""} — {v.enhet}
        </option>
      ))}
    </select>
  );
}
