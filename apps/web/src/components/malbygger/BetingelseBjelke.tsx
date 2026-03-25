"use client";

import { useState, useRef, useEffect } from "react";
import type { MalObjekt } from "./DraggbartFelt";

// Hent streng-verdi fra opsjon (støtter både string og {label, value}-format)
function opsjonTilStreng(opsjon: unknown): string {
  if (typeof opsjon === "string") return opsjon;
  if (typeof opsjon === "object" && opsjon !== null) {
    const obj = opsjon as Record<string, unknown>;
    if (typeof obj.label === "string") return obj.label;
    if (typeof obj.value === "string") return obj.value;
  }
  return String(opsjon);
}

interface BetingelseBjelkeProps {
  parentObjekt: MalObjekt;
  aktiveVerdier: string[];
  onEndreVerdier: (verdier: string[]) => void;
  onFjern: () => void;
}

export function BetingelseBjelke({
  parentObjekt,
  aktiveVerdier,
  onEndreVerdier,
  onFjern,
}: BetingelseBjelkeProps) {
  const [dropdownÅpen, setDropdownÅpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Normaliser verdier i tilfelle de er objekter fra eksisterende data
  const normaliserteVerdier = (aktiveVerdier as unknown[]).map(opsjonTilStreng);
  const råOpsjoner = (parentObjekt.config.options as unknown[]) ?? [];
  const tilgjengeligeOpsjoner = råOpsjoner.map(opsjonTilStreng);
  const ikkeValgte = tilgjengeligeOpsjoner.filter((o) => !normaliserteVerdier.includes(o));

  useEffect(() => {
    function handleKlikk(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownÅpen(false);
      }
    }
    if (dropdownÅpen) {
      document.addEventListener("mousedown", handleKlikk);
      return () => document.removeEventListener("mousedown", handleKlikk);
    }
  }, [dropdownÅpen]);

  function fjernVerdi(verdi: string) {
    const nye = aktiveVerdier.filter((v) => v !== verdi);
    if (nye.length === 0) {
      onFjern();
    } else {
      onEndreVerdier(nye);
    }
  }

  function leggTilVerdi(verdi: string) {
    onEndreVerdier([...aktiveVerdier, verdi]);
    setDropdownÅpen(false);
  }

  return (
    <div className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <svg className="h-4 w-4 shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="shrink-0 text-sm text-blue-700">
            Vis felter hvis verdien er en av følgende:
          </span>
          {normaliserteVerdier.map((verdi) => (
            <span
              key={verdi}
              className="inline-flex items-center gap-1 rounded-full bg-blue-200 px-2.5 py-0.5 text-xs font-medium text-blue-800"
            >
              {verdi}
              <button
                type="button"
                onClick={() => fjernVerdi(verdi)}
                className="ml-0.5 text-blue-600 hover:text-blue-900"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>

        <button
          type="button"
          onClick={onFjern}
          className="shrink-0 rounded p-1 text-blue-400 hover:bg-blue-100 hover:text-blue-600"
          title="Fjern betingelse"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {ikkeValgte.length > 0 && (
        <div ref={dropdownRef} className="relative ml-6 mt-1.5">
          <button
            type="button"
            onClick={() => setDropdownÅpen(!dropdownÅpen)}
            className="inline-flex items-center gap-1 rounded-full border border-blue-300 bg-white px-2.5 py-0.5 text-xs text-blue-600 hover:bg-blue-50"
          >
            Velg...
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {dropdownÅpen && (
            <div className="absolute left-0 top-full z-50 mt-1 w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              {ikkeValgte.map((opsjon) => (
                <button
                  key={opsjon}
                  type="button"
                  className="w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-blue-50"
                  onClick={() => leggTilVerdi(opsjon)}
                >
                  {opsjon}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
