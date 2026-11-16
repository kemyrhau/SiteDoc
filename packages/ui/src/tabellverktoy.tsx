import { useState, useMemo, useRef, useEffect, useCallback, type MouseEvent as ReactMouseEvent } from "react";

/**
 * Hodets verktøy — ÉN kilde (spec prosjektkort-kortid R1/T51, ordre d2b-1).
 * Sorterpil, filternedtrekk og bredde-håndtak ble løftet ut av `Table` så både
 * `Table` (sjekklister, oppgaver, HMS, mapper, faggrupper) og `TimerRadTabell`
 * (attestering, rapportens Detaljer) bruker de samme delene. `Table` tegner det
 * samme som før (T46). Flyttehåndtaket bor i apps/web (`FlyttbareKolonner.tsx`,
 * dnd-kit er ikke en ui-avhengighet).
 *
 * Tekstene kommer inn som props (R20): kalleren sender `t()`. Standarden er
 * dagens norske tekst, så sider som ikke sender noe, er uendret.
 */

export type SorterRetning = "asc" | "desc";

/* Inline SVG-ikoner for å unngå lucide-react avhengighet */
export function SorterPil({ retning }: { retning: SorterRetning }) {
  return (
    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={retning === "asc" ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"} />
    </svg>
  );
}

function FilterIkon() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

export interface KolonneFilterTekster {
  /** title/aria-label på filterikonet */
  filtrer: string;
  /** første valg: fjern filteret */
  alle: string;
  /** plassholder i tekstsøket (bare når `sok` er satt) */
  sok?: string;
}

/** Dagens norske tekst — standard når kalleren ikke sender `t()` (T46). */
export const STANDARD_FILTER_TEKSTER: KolonneFilterTekster = { filtrer: "Filtrer", alle: "Alle" };

/**
 * Filternedtrekk i kolonnehodet: avkryssing blant verdiene (komma-separert verdi),
 * valgfrie snarveier, og valgfritt tekstsøk i samme nedtrekk (R8: Beskrivelse).
 */
export function KolonneFilter({
  alternativer,
  snarveier,
  verdi,
  onChange,
  tekster = STANDARD_FILTER_TEKSTER,
  sok,
}: {
  alternativer: { value: string; label: string }[];
  snarveier?: { label: string; verdier: string[] }[];
  verdi: string;
  onChange: (verdi: string) => void;
  tekster?: KolonneFilterTekster;
  /** Tekstsøk øverst i nedtrekket. Aktivt søk teller som aktivt filter. */
  sok?: { verdi: string; onChange: (v: string) => void };
}) {
  const [apen, setApen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Parse komma-separert verdi til Set
  const valgteVerdier = useMemo(() => {
    if (!verdi) return new Set<string>();
    return new Set(verdi.split(","));
  }, [verdi]);

  function toggleVerdi(v: string) {
    const ny = new Set(valgteVerdier);
    if (ny.has(v)) ny.delete(v); else ny.add(v);
    onChange(ny.size > 0 ? [...ny].join(",") : "");
  }

  useEffect(() => {
    function handleKlikk(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setApen(false);
      }
    }
    if (apen) document.addEventListener("mousedown", handleKlikk);
    return () => document.removeEventListener("mousedown", handleKlikk);
  }, [apen]);

  const harFilter = valgteVerdier.size > 0 || (sok?.verdi ?? "") !== "";

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setApen(!apen);
        }}
        className={`ml-1 inline-flex items-center rounded p-0.5 hover:bg-gray-200 ${
          harFilter ? "text-blue-600" : "text-gray-400"
        }`}
        title={tekster.filtrer}
      >
        <FilterIkon />
      </button>
      {apen && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[160px] rounded-md border border-gray-200 bg-white py-1 shadow-lg max-h-[300px] overflow-y-auto">
          {sok && (
            <div className="border-b border-gray-100 px-2 pb-1" onClick={(e) => e.stopPropagation()}>
              <input
                type="search"
                value={sok.verdi}
                onChange={(e) => sok.onChange(e.target.value)}
                placeholder={tekster.sok}
                aria-label={tekster.sok}
                className="w-full rounded border border-gray-200 px-2 py-1 text-xs normal-case tracking-normal"
              />
            </div>
          )}
          <button
            onClick={() => {
              onChange("");
              sok?.onChange("");
              setApen(false);
            }}
            className={`block w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50 ${
              !harFilter ? "font-semibold text-blue-600" : "text-gray-600"
            }`}
          >
            {tekster.alle}
          </button>
          {snarveier && snarveier.length > 0 && (
            <div className="border-b border-gray-100">
              {snarveier.map((sn) => {
                const snarveiVerdi = sn.verdier.join(",");
                const erAktiv = verdi === snarveiVerdi;
                return (
                  <button
                    key={sn.label}
                    onClick={() => {
                      onChange(snarveiVerdi);
                      setApen(false);
                    }}
                    className={`block w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50 ${
                      erAktiv ? "font-semibold text-blue-600" : "text-gray-600"
                    }`}
                  >
                    {sn.label}
                  </button>
                );
              })}
            </div>
          )}
          {alternativer.map((alt) => (
            <label
              key={alt.value}
              className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 cursor-pointer"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={valgteVerdier.has(alt.value)}
                onChange={() => toggleVerdi(alt.value)}
                className="rounded text-blue-600 h-3 w-3"
              />
              <span className={valgteVerdier.has(alt.value) ? "font-medium text-blue-600" : "text-gray-600"}>
                {alt.label}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Bredde-dragning: start på håndtaket, følg musa, avslutt på mouseup.
 * `startBredde(id)` gir bredden i px når dragningen starter. `onLive` får hver ny
 * bredde underveis (minst `minBredde`), `onSlutt` kalles én gang ved slipp.
 */
export function useBreddeDragning({
  startBredde,
  onLive,
  onSlutt,
  minBredde = 40,
}: {
  startBredde: (kolonneId: string) => number | undefined;
  onLive: (kolonneId: string, bredde: number) => void;
  onSlutt: (kolonneId: string) => void;
  minBredde?: number;
}): { aktivId: string | null; start: (e: ReactMouseEvent, kolonneId: string) => void } {
  const [aktivId, setAktivId] = useState<string | null>(null);
  const startX = useRef(0);
  const startB = useRef(0);
  // Siste callbacks i ref: effekten skal ikke rives ned midt i en dragning.
  const cb = useRef({ onLive, onSlutt });
  cb.current = { onLive, onSlutt };

  const start = useCallback((e: ReactMouseEvent, kolonneId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const b = startBredde(kolonneId);
    if (b === undefined) return;
    startX.current = e.clientX;
    startB.current = b;
    setAktivId(kolonneId);
  }, [startBredde]);

  useEffect(() => {
    if (!aktivId) return;
    const handleMove = (e: MouseEvent) => {
      const diff = e.clientX - startX.current;
      cb.current.onLive(aktivId, Math.max(minBredde, startB.current + diff));
    };
    const handleUp = () => {
      setAktivId(null);
      cb.current.onSlutt(aktivId);
    };
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };
  }, [aktivId, minBredde]);

  return { aktivId, start };
}

/** Bredde-håndtaket i høyre kant av en overskrift. */
export function BreddeHandtak({ aktiv, onMouseDown }: { aktiv: boolean; onMouseDown: (e: ReactMouseEvent) => void }) {
  return (
    <div
      onMouseDown={onMouseDown}
      className={`absolute -right-1 top-0 z-10 h-full w-2 cursor-col-resize ${
        aktiv ? "bg-blue-400" : "bg-gray-300 hover:bg-blue-400"
      }`}
      style={{ width: "3px" }}
    />
  );
}
