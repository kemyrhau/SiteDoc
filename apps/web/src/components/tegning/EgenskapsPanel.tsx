"use client";

import { useTranslation } from "react-i18next";
import type { EgenskapsFelt, EgenskapsFeltNokkel } from "@sitedoc/shared";

/**
 * F1 (O2, spec § 8): sidepanel for dxf-viewer-grenen, web. Viser feltene
 * `byggEgenskapsfelt()` (`@sitedoc/shared`) bygger fra O1-registeret, i F1 § 3 sin
 * rekkefølge. IKKE koblet til 3D-kortet (`EgenskapsPopup`) i denne runden — bevisst
 * avgrensning, se `relay/inbox-orkestrator.md` (orkestrator-avklaring A, 2026-10-17).
 */

interface EgenskapsPanelProps {
  felt: EgenskapsFelt[] | null;
  onLukk: () => void;
}

const FELT_LABEL_NOKKEL: Record<EgenskapsFeltNokkel, string> = {
  hva: "tegningsvelger.egenskaper.feltHva",
  typeStorrelse: "tegningsvelger.egenskaper.feltTypeStorrelse",
  rom: "tegningsvelger.egenskaper.feltRom",
  materiale: "tegningsvelger.egenskaper.feltMateriale",
  tekst: "tegningsvelger.egenskaper.feltTekst",
  naermesteMerking: "tegningsvelger.egenskaper.feltNaermesteMerking",
  mal: "tegningsvelger.egenskaper.feltMal",
  status: "tegningsvelger.egenskaper.feltStatus",
  linjetype: "tegningsvelger.egenskaper.feltLinjetype",
  id: "tegningsvelger.egenskaper.feltId",
};

export function EgenskapsPanel({ felt, onLukk }: EgenskapsPanelProps) {
  const { t } = useTranslation();
  if (!felt || felt.length === 0) return null;

  return (
    <div
      data-testid="egenskapspanel"
      className="absolute right-3 top-3 z-10 max-h-[70vh] w-72 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg"
    >
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
        <span className="text-sm font-medium text-gray-900">{t("tegningsvelger.egenskaper.tittel")}</span>
        <button
          type="button"
          onClick={onLukk}
          className="text-gray-400 hover:text-gray-600"
          aria-label={t("handling.lukk")}
        >
          ×
        </button>
      </div>
      <dl className="divide-y divide-gray-100">
        {felt.map((f, i) => (
          <div key={`${f.nokkel}-${i}`} className="px-3 py-2">
            <dt className="text-xs text-gray-500">{t(FELT_LABEL_NOKKEL[f.nokkel])}</dt>
            <dd className={f.tolket ? "text-sm italic text-gray-500" : "text-sm text-gray-900"}>
              {f.verdi}
              {f.nokkel === "naermesteMerking" && ` (${t("tegningsvelger.egenskaper.naermesteMerkingSuffiks")})`}
            </dd>
            {f.underverdi && <dd className="text-xs text-gray-400">{f.underverdi}</dd>}
          </div>
        ))}
      </dl>
    </div>
  );
}
