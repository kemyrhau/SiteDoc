import { useState, useRef, useEffect } from "react";
import type { RapportObjektProps } from "./typer";
import { normaliserOpsjon } from "./typer";
import { ChevronDown, X } from "lucide-react";

export function FlervalgObjekt({ objekt, verdi, onEndreVerdi, leseModus }: RapportObjektProps) {
  const råOpsjoner = (objekt.config.options as unknown[]) ?? [];
  const alternativer = råOpsjoner.map(normaliserOpsjon);
  const valgteVerdier = Array.isArray(verdi) ? (verdi as string[]) : [];
  const [åpen, setÅpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Lukk dropdown ved klikk utenfor
  useEffect(() => {
    if (!åpen) return;
    function handleKlikk(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setÅpen(false);
      }
    }
    document.addEventListener("mousedown", handleKlikk);
    return () => document.removeEventListener("mousedown", handleKlikk);
  }, [åpen]);

  const veksle = (alternativVerdi: string) => {
    if (leseModus) return;
    if (valgteVerdier.includes(alternativVerdi)) {
      onEndreVerdi(valgteVerdier.filter((v) => v !== alternativVerdi));
    } else {
      onEndreVerdi([...valgteVerdier, alternativVerdi]);
    }
  };

  const fjern = (alternativVerdi: string) => {
    if (leseModus) return;
    onEndreVerdi(valgteVerdier.filter((v) => v !== alternativVerdi));
  };

  // Lesemodus: vis som horisontale chips
  if (leseModus) {
    if (valgteVerdier.length === 0) {
      return <p className="text-sm italic text-gray-400">Ingen valgt</p>;
    }
    return (
      <div className="flex flex-wrap gap-1.5">
        {valgteVerdier.map((v) => {
          const label = alternativer.find((a) => a.value === v)?.label ?? v;
          return (
            <span key={v} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
              {label}
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Valgte chips + dropdown-trigger */}
      <button
        type="button"
        onClick={() => setÅpen(!åpen)}
        className="flex min-h-[38px] w-full items-center gap-1 rounded-md border border-gray-300 px-2 py-1.5 text-left focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <div className="flex flex-1 flex-wrap gap-1">
          {valgteVerdier.length === 0 ? (
            <span className="text-sm text-gray-400">Velg...</span>
          ) : (
            valgteVerdier.map((v) => {
              const label = alternativer.find((a) => a.value === v)?.label ?? v;
              return (
                <span
                  key={v}
                  className="flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
                >
                  {label}
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); fjern(v); }}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-blue-100"
                  >
                    <X className="h-3 w-3" />
                  </span>
                </span>
              );
            })
          )}
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${åpen ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown-liste */}
      {åpen && (
        <div className="absolute left-0 top-full z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
          {alternativer.map((alt, index) => {
            const erValgt = valgteVerdier.includes(alt.value);
            return (
              <button
                key={`${alt.value}-${index}`}
                type="button"
                onClick={() => veksle(alt.value)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    erValgt ? "border-blue-600 bg-blue-600" : "border-gray-300"
                  }`}
                >
                  {erValgt && (
                    <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className="text-gray-900">{alt.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
