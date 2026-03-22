"use client";

import { useState } from "react";
import {
  X,
  ChevronDown,
  Filter,
  Eye,
} from "lucide-react";
import type { AktivtFilter, SkjultObjekt } from "../typer";

export function FilterChipBar({
  aktiveFiltre,
  skjulteObjekter,
  onFjernFilter,
  onFjernSkjultObjekt,
  onNullstillAlt,
}: {
  aktiveFiltre: AktivtFilter[];
  skjulteObjekter: SkjultObjekt[];
  onFjernFilter: (filter: AktivtFilter) => void;
  onFjernSkjultObjekt: (obj: SkjultObjekt) => void;
  onNullstillAlt: () => void;
}) {
  const [åpen, setÅpen] = useState(false);
  const filterLabels: Record<AktivtFilter["type"], string> = {
    kategori: "Kategori",
    type: "Type",
    lag: "Lag",
    system: "System",
  };

  const totalt = aktiveFiltre.length + skjulteObjekter.length;

  return (
    <div className="relative flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-1.5">
      <button
        onClick={() => setÅpen(!åpen)}
        className="flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
      >
        <Filter className="h-3.5 w-3.5 text-gray-400" />
        {totalt} skjult
        <ChevronDown className={`h-3 w-3 text-gray-400 transition-transform ${åpen ? "rotate-180" : ""}`} />
      </button>

      {/* Vis aktive filtre som chips inline (maks 3) */}
      {aktiveFiltre.slice(0, 3).map((f) => (
        <button
          key={`${f.type}-${f.verdi}`}
          onClick={() => onFjernFilter(f)}
          className="flex shrink-0 items-center gap-1 rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-300"
          title={`Vis igjen: ${filterLabels[f.type]}: ${f.verdi}`}
        >
          <X className="h-3 w-3" />
          {filterLabels[f.type]}: {f.verdi}
        </button>
      ))}
      {aktiveFiltre.length > 3 && (
        <span className="text-xs text-gray-400">+{aktiveFiltre.length - 3} filtre</span>
      )}

      <button
        onClick={onNullstillAlt}
        className="shrink-0 rounded px-2 py-0.5 text-xs font-medium text-sitedoc-error hover:bg-red-50"
      >
        Nullstill
      </button>

      {/* Nedtrekksmeny */}
      {åpen && (
        <div className="absolute left-0 top-full z-20 w-80 max-h-64 overflow-y-auto rounded-b-lg border border-t-0 border-gray-200 bg-white shadow-lg">
          {aktiveFiltre.length > 0 && (
            <div className="border-b border-gray-100 px-3 py-2">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Filtre</p>
              {aktiveFiltre.map((f) => (
                <div
                  key={`${f.type}-${f.verdi}`}
                  className="flex items-center justify-between py-0.5"
                >
                  <span className="text-xs text-gray-700">
                    <span className="text-gray-400">{filterLabels[f.type]}:</span> {f.verdi}
                  </span>
                  <button
                    onClick={() => onFjernFilter(f)}
                    className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-sitedoc-secondary hover:bg-gray-100"
                  >
                    <Eye className="h-3 w-3" />
                    Vis
                  </button>
                </div>
              ))}
            </div>
          )}

          {skjulteObjekter.length > 0 && (
            <div className="px-3 py-2">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Objekter ({skjulteObjekter.length})
              </p>
              {skjulteObjekter.map((obj) => (
                <div
                  key={`${obj.modelId}-${obj.localId}`}
                  className="flex items-center justify-between py-0.5"
                >
                  <span className="truncate text-xs text-gray-700" title={`${obj.kategori}: ${obj.navn}`}>
                    <span className="text-gray-400">{obj.kategori}:</span> {obj.navn || `#${obj.localId}`}
                  </span>
                  <button
                    onClick={() => onFjernSkjultObjekt(obj)}
                    className="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs text-sitedoc-secondary hover:bg-gray-100"
                  >
                    <Eye className="h-3 w-3" />
                    Vis
                  </button>
                </div>
              ))}
            </div>
          )}

          {totalt === 0 && (
            <div className="px-3 py-3 text-center text-xs text-gray-400">Ingen skjulte elementer</div>
          )}
        </div>
      )}
    </div>
  );
}
