"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";

/**
 * Søkbar multi-select-combobox med chip-visning av valgte under knappen.
 *
 * - Søkefelt alltid synlig i dropdown, filtrerer options i sanntid på `name`
 * - Valgte vises som chips under nedtrekksknappen — alltid synlig uten å
 *   åpne menyen. Hver chip har X-knapp som kaller onToggle for å fjerne.
 * - Klikk utenfor lukker dropdown.
 *
 * Referanseimplementasjon: apps/web/src/app/dashbord/firma/hms/page.tsx
 * (firma-HMS-dashboard filter-panel).
 */
export type MultiComboksOption = {
  id: string;
  name: string;
  /** Valgfritt antall som vises i parentes etter navnet, f.eks. "Markussen B12 (3)". */
  antall?: number;
  /** Valgfri sekundær-tekst, f.eks. prosjekt-navn under et byggeplass-valg. */
  underTekst?: string;
};

export function MultiComboks({
  label,
  options,
  valgte,
  onToggle,
  placeholderSok,
}: {
  label: string;
  options: MultiComboksOption[];
  valgte: string[];
  onToggle: (id: string) => void;
  placeholderSok?: string;
}) {
  const [apen, setApen] = useState(false);
  const [sok, setSok] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function klikkUtenfor(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setApen(false);
    }
    if (apen) document.addEventListener("mousedown", klikkUtenfor);
    return () => document.removeEventListener("mousedown", klikkUtenfor);
  }, [apen]);

  const filtrerte = useMemo(() => {
    if (!sok.trim()) return options;
    const q = sok.toLowerCase().trim();
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, sok]);

  const valgteSet = useMemo(() => new Set(valgte), [valgte]);
  const valgteOptions = useMemo(
    () => options.filter((o) => valgteSet.has(o.id)),
    [options, valgteSet],
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setApen(!apen)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
      >
        <span className="truncate">
          {label}
          {valgte.length > 0 && (
            <span className="ml-1 inline-flex items-center justify-center rounded-full bg-sitedoc-primary px-2 py-0.5 text-xs font-medium text-white">
              {valgte.length}
            </span>
          )}
        </span>
        <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
      </button>

      {/* Chips for valgte — alltid synlig uten å åpne menyen */}
      {valgteOptions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {valgteOptions.map((o) => (
            <span
              key={o.id}
              className="inline-flex items-center gap-1 rounded-full bg-sitedoc-primary/10 px-2 py-0.5 text-xs text-sitedoc-primary"
            >
              <span className="truncate max-w-[180px]">{o.name}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle(o.id);
                }}
                className="rounded-full p-0.5 hover:bg-sitedoc-primary/20"
                aria-label={`Fjern ${o.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {apen && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
          {/* Søkefelt alltid synlig */}
          <div className="sticky top-0 border-b border-gray-100 bg-white p-2">
            <input
              type="text"
              value={sok}
              onChange={(e) => setSok(e.target.value)}
              placeholder={placeholderSok ?? "Søk..."}
              className="w-full rounded border border-gray-200 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
          </div>
          <div className="max-h-72 overflow-y-auto">
            {filtrerte.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">—</div>
            ) : (
              filtrerte.map((o) => {
                const valgt = valgteSet.has(o.id);
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => onToggle(o.id)}
                    className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors ${
                      valgt ? "bg-sitedoc-primary/5" : "hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={valgt}
                      readOnly
                      className="mt-0.5 h-4 w-4 flex-shrink-0"
                    />
                    <span className="flex-1 truncate">
                      <span className="text-gray-900">{o.name}</span>
                      {o.antall !== undefined && (
                        <span className="ml-1 text-xs text-gray-500">({o.antall})</span>
                      )}
                      {o.underTekst && (
                        <span className="ml-2 text-xs text-gray-400">· {o.underTekst}</span>
                      )}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
