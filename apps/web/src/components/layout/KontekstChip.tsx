"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Building2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { useFirma } from "@/kontekst/firma-kontekst";
import { FirmaVelgerPanel } from "./FirmaVelger";
import { ProsjektVelgerPanel } from "./ProsjektVelger";

/**
 * KontekstChip (steg iii) — samlet «{Firma} / {Prosjekt} ▾»-velger bak
 * `nyNavigasjon`-flagget. Erstatter FirmaVelger + ProsjektVelger i Toppbar.
 * Ett popover: firma øverst (kun sitedoc_admin som kan bytte), prosjekter
 * hierarkisk under — gjenbruker panel-innmatene så scope-rader, favoritter
 * og søke-terskler bevares.
 *
 * Funn 1b: prosjekt-delen av chip-teksten viser lastetilstand når et
 * prosjektId er persistert men objektet ennå ikke er resolvet — ikke tom
 * streng, ikke «velg prosjekt» (som ville blinket ved hver fersk økt).
 */
export function KontekstChip() {
  const { t } = useTranslation();
  const { valgtFirma, erSitedocAdmin } = useFirma();
  const { valgtProsjekt, prosjektId, lasterValgtProsjekt, prosjektScope } = useProsjekt();
  const [apen, setApen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKlikk(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setApen(false);
      }
    }
    document.addEventListener("mousedown", handleKlikk);
    return () => document.removeEventListener("mousedown", handleKlikk);
  }, []);

  const firmaTekst = valgtFirma?.name ?? t("kontekstChip.velgFirma");

  const prosjektTekst = valgtProsjekt?.name
    ?? (prosjektId && lasterValgtProsjekt
      ? t("kontekstChip.laster")
      : prosjektScope === "alle"
        ? t("prosjektVelger.alleProsjekter")
        : prosjektScope === "mine"
          ? t("prosjektVelger.mineProsjekter")
          : t("kontekstChip.velgProsjekt"));

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setApen(!apen)}
        className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white transition-colors hover:bg-white/20"
      >
        <Building2 className="h-4 w-4 shrink-0" />
        <span className="max-w-[130px] truncate text-blue-100">{firmaTekst}</span>
        <span className="text-blue-300">/</span>
        <span className="max-w-[180px] truncate">{prosjektTekst}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${apen ? "rotate-180" : ""}`} />
      </button>

      {apen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-gray-200 bg-white shadow-xl">
          {erSitedocAdmin && (
            <div>
              <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                {t("kontekstChip.firma")}
              </p>
              <FirmaVelgerPanel onValgt={() => setApen(false)} />
            </div>
          )}
          <div>
            <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              {t("kontekstChip.prosjekt")}
            </p>
            <ProsjektVelgerPanel onValgt={() => setApen(false)} autoFocus={!erSitedocAdmin} />
          </div>
        </div>
      )}
    </div>
  );
}
