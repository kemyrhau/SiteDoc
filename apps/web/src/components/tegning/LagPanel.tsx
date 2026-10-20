"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { byggLagGrupper, type RegisterVerdenLagInfo } from "@sitedoc/shared";
import { ChevronDown, ChevronRight } from "lucide-react";

/**
 * F2 (spec § 3): lagpanel for dxf-viewer-grenen, web. To nivåer — gruppe → rå lag
 * under — fra `laginventar` (gruppe/visningsnavn/antall allerede beregnet
 * server-side, se `render.py` sin `tolk_lag_gruppe`/`lag_dominante_revit_kategorier`).
 * "Kontrollert" komponent: synligheten eies av kalleren (page.tsx, som også står
 * for husking pr. tegning pr. bruker, F2 § 3).
 * Grupperingen (`byggLagGrupper`) er flyttet til `@sitedoc/shared` (RETUR F1+F2 web
 * r2) slik at mobil-lagpanelet (`TegningLagPanel.tsx`) garantert viser samme
 * gruppe-inndeling — IKKE en egen implementasjon her.
 */

interface LagPanelProps {
  laginventar: RegisterVerdenLagInfo[];
  synlighet: Record<string, boolean>;
  onSettLag: (navn: string, synlig: boolean) => void;
  onSettGruppe: (lagNavn: string[], synlig: boolean) => void;
  onBareDette: (navn: string) => void;
  onAllePaa: () => void;
  onAlleAv: () => void;
  onLukk: () => void;
}

export function LagPanel({ laginventar, synlighet, onSettLag, onSettGruppe, onBareDette, onAllePaa, onAlleAv, onLukk }: LagPanelProps) {
  const { t } = useTranslation();
  const grupper = useMemo(() => byggLagGrupper(laginventar), [laginventar]);
  const [apne, setApne] = useState<Set<string>>(() => new Set());

  function vekslApen(navn: string) {
    setApne((s) => {
      const neste = new Set(s);
      if (neste.has(navn)) neste.delete(navn);
      else neste.add(navn);
      return neste;
    });
  }

  return (
    <div
      data-testid="lagpanel"
      className="absolute right-3 top-3 bottom-3 z-10 flex w-80 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
    >
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
        <span className="text-sm font-medium text-gray-900">{t("tegningsvelger.lag.tittel")}</span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onAllePaa} className="text-xs font-medium text-sitedoc-primary hover:underline">
            {t("tegningsvelger.lag.allePaa")}
          </button>
          <button type="button" onClick={onAlleAv} className="text-xs font-medium text-sitedoc-primary hover:underline">
            {t("tegningsvelger.lag.alleAv")}
          </button>
          <button type="button" onClick={onLukk} className="text-gray-400 hover:text-gray-600" aria-label={t("handling.lukk")}>
            ×
          </button>
        </div>
      </div>
      <div className="flex-1 divide-y divide-gray-100 overflow-y-auto">
        {grupper.map((g) => {
          const alleAv = g.lag.every((l) => synlighet[l.navn] === false);
          const alleSynlig = g.lag.every((l) => synlighet[l.navn] !== false);
          const apen = apne.has(g.navn);
          return (
            <div key={g.navn}>
              <div className="flex items-center gap-2 px-3 py-2">
                <button
                  type="button"
                  onClick={() => vekslApen(g.navn)}
                  className="text-gray-400"
                  aria-label={apen ? t("handling.skjul") : t("handling.vis")}
                >
                  {apen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                <input
                  type="checkbox"
                  checked={alleSynlig}
                  ref={(el) => {
                    if (el) el.indeterminate = !alleSynlig && !alleAv;
                  }}
                  onChange={(e) => onSettGruppe(g.lag.map((l) => l.navn), e.target.checked)}
                  className="h-4 w-4"
                />
                <span className="flex-1 truncate text-sm text-gray-900">
                  {g.navn !== g.gruppeNavn && <span className="text-gray-400">{g.navn} </span>}
                  {g.gruppeNavn}
                </span>
                <span className="text-xs text-gray-400">{g.antallTotal}</span>
              </div>
              {apen && (
                <div className="bg-gray-50 pb-1">
                  {g.lag.map((l) => {
                    const synlig = synlighet[l.navn] !== false;
                    return (
                      <div key={l.navn} className="flex items-center gap-2 py-1 pl-9 pr-3">
                        <input
                          type="checkbox"
                          checked={synlig}
                          onChange={(e) => onSettLag(l.navn, e.target.checked)}
                          className="h-3.5 w-3.5"
                        />
                        <span className="flex-1 truncate text-xs text-gray-700" title={l.navn}>
                          {l.visningsnavn}
                        </span>
                        <span className="text-xs text-gray-400">{l.antall}</span>
                        <button
                          type="button"
                          onClick={() => onBareDette(l.navn)}
                          className="text-xs text-sitedoc-primary hover:underline"
                        >
                          {t("tegningsvelger.lag.bareDette")}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
