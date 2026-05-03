"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, Building2 } from "lucide-react";
import { useFirma } from "@/kontekst/firma-kontekst";

/**
 * Søkbar firma-velger for sitedoc_admin i Toppbar.
 * Vises kun for sitedoc_admin (komponenten gates av Toppbar — ikke selv).
 * For company_admin med fast hjemfirma er ikke denne aktuell.
 */
export function FirmaVelger() {
  const { valgtFirma, tilgjengelige, velgFirma } = useFirma();
  const [apen, setApen] = useState(false);
  const [sok, setSok] = useState("");
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

  const filtrerte = tilgjengelige.filter((f) =>
    f.name.toLowerCase().includes(sok.toLowerCase()),
  );

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setApen(!apen)}
        className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white transition-colors hover:bg-white/20"
        title={valgtFirma ? `Aktivt firma: ${valgtFirma.name}` : "Velg firma"}
      >
        <Building2 className="h-4 w-4" />
        <span className="max-w-[200px] truncate">
          {valgtFirma?.name ?? "Velg firma"}
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${apen ? "rotate-180" : ""}`} />
      </button>

      {apen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-gray-200 bg-white shadow-xl">
          <div className="border-b border-gray-100 p-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={sok}
                onChange={(e) => setSok(e.target.value)}
                placeholder="Søk firmaer..."
                className="w-full rounded-md border border-gray-200 py-1.5 pl-8 pr-3 text-sm text-gray-700 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-64 overflow-auto py-1">
            {filtrerte.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-400">
                Ingen firmaer funnet
              </p>
            ) : (
              filtrerte.map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    velgFirma(f.id);
                    setApen(false);
                    setSok("");
                  }}
                  className={`flex w-full flex-col px-3 py-2 text-left transition-colors hover:bg-blue-50 ${
                    valgtFirma?.id === f.id ? "bg-blue-50" : ""
                  }`}
                >
                  <span className="text-sm font-medium text-gray-900">
                    {f.name}
                  </span>
                  <span className="text-xs text-gray-500">
                    {[
                      f.harMaskinModul ? "Maskin" : null,
                      f.harTimerModul ? "Timer" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Ingen moduler"}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
