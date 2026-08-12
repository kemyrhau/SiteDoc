"use client";

import { useTranslation } from "react-i18next";

/**
 * «Vis inaktive (N)»-bryter (2026-08-12). Sier HVOR MANGE, ikke en naken checkbox.
 * Er N=0 deaktiveres kontrollen — da finnes ingenting å vise, og brukeren slipper
 * å lure på om filteret er i stuss. Krever at kalleren henter ALLE rader (aktive +
 * inaktive) og teller de inaktive selv, så tallet finnes uten et ekstra kall.
 */
export function VisInaktiveToggle({
  antall,
  checked,
  onChange,
}: {
  antall: number;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const { t } = useTranslation();
  const deaktivert = antall === 0;
  return (
    <label
      className={`mb-3 inline-flex items-center gap-2 text-sm ${
        deaktivert ? "cursor-not-allowed text-gray-300" : "text-gray-600"
      }`}
    >
      <input
        type="checkbox"
        checked={checked && !deaktivert}
        disabled={deaktivert}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 disabled:opacity-40"
      />
      {t("deaktiver.visInaktive", { antall })}
    </label>
  );
}
