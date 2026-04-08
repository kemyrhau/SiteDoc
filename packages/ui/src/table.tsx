import { useState, useMemo, useRef, useEffect, useCallback, type ReactNode } from "react";

interface KolonneDef<T> {
  id: string;
  header: string;
  celle: (rad: T) => ReactNode;
  bredde?: string;
  sorterbar?: boolean;
  sorterVerdi?: (rad: T) => string | number | null;
  filtrerbar?: boolean;
  filterAlternativer?: { value: string; label: string }[];
}

type SorterRetning = "asc" | "desc";

interface TableProps<T> {
  kolonner: KolonneDef<T>[];
  data: T[];
  radNokkel: (rad: T) => string;
  onRadKlikk?: (rad: T) => void;
  onRadDobbeltklikk?: (rad: T) => void;
  tomMelding?: string;
  velgbar?: boolean;
  valgteRader?: Set<string>;
  onValgEndring?: (valgteIder: Set<string>) => void;
  filterVerdier?: Record<string, string>;
  onFilterEndring?: (kolonneId: string, verdi: string) => void;
  /** Lagrede kolonnebredder i piksler */
  kolonneBredder?: Record<string, number>;
  /** Callback når bruker endrer kolonnebredde */
  onKolonneBreddeEndring?: (bredder: Record<string, number>) => void;
}

function IndeterminateCheckbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
    />
  );
}

/* Inline SVG-ikoner for å unngå lucide-react avhengighet */
function SorterPilOpp() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 15l-6-6-6 6" />
    </svg>
  );
}

function SorterPilNed() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
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

function FilterDropdown({
  alternativer,
  verdi,
  onChange,
}: {
  alternativer: { value: string; label: string }[];
  verdi: string;
  onChange: (verdi: string) => void;
}) {
  const [apen, setApen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKlikk(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setApen(false);
      }
    }
    if (apen) document.addEventListener("mousedown", handleKlikk);
    return () => document.removeEventListener("mousedown", handleKlikk);
  }, [apen]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setApen(!apen);
        }}
        className={`ml-1 inline-flex items-center rounded p-0.5 hover:bg-gray-200 ${
          verdi ? "text-blue-600" : "text-gray-400"
        }`}
        title="Filtrer"
      >
        <FilterIkon />
      </button>
      {apen && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[160px] rounded-md border border-gray-200 bg-white py-1 shadow-lg">
          <button
            onClick={() => {
              onChange("");
              setApen(false);
            }}
            className={`block w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50 ${
              !verdi ? "font-semibold text-blue-600" : "text-gray-600"
            }`}
          >
            Alle
          </button>
          {alternativer.map((alt) => (
            <button
              key={alt.value}
              onClick={() => {
                onChange(alt.value);
                setApen(false);
              }}
              className={`block w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50 ${
                verdi === alt.value ? "font-semibold text-blue-600" : "text-gray-600"
              }`}
            >
              {alt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Table<T>({
  kolonner,
  data,
  radNokkel,
  onRadKlikk,
  onRadDobbeltklikk,
  tomMelding = "Ingen data å vise",
  velgbar,
  valgteRader,
  onValgEndring,
  filterVerdier,
  onFilterEndring,
  kolonneBredder,
  onKolonneBreddeEndring,
}: TableProps<T>) {
  const [sorterKolonne, setSorterKolonne] = useState<string | null>(null);
  const [sorterRetning, setSorterRetning] = useState<SorterRetning>("asc");

  // Resize-state
  const [resizeKolId, setResizeKolId] = useState<string | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartBredde = useRef(0);
  const lokaleBreader = useRef<Record<string, number>>({});
  const thRefs = useRef<Record<string, HTMLTableCellElement | null>>({});

  const handleResizeStart = useCallback((e: React.MouseEvent, kolId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const th = thRefs.current[kolId];
    if (!th) return;
    resizeStartX.current = e.clientX;
    resizeStartBredde.current = th.offsetWidth;
    setResizeKolId(kolId);
  }, []);

  useEffect(() => {
    if (!resizeKolId) return;
    const handleMove = (e: MouseEvent) => {
      const diff = e.clientX - resizeStartX.current;
      const nyBredde = Math.max(40, resizeStartBredde.current + diff);
      lokaleBreader.current = { ...lokaleBreader.current, [resizeKolId]: nyBredde };
      const th = thRefs.current[resizeKolId];
      if (th) th.style.width = `${nyBredde}px`;
    };
    const handleUp = () => {
      setResizeKolId(null);
      if (onKolonneBreddeEndring) {
        onKolonneBreddeEndring({ ...kolonneBredder, ...lokaleBreader.current });
      }
    };
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };
  }, [resizeKolId, kolonneBredder, onKolonneBreddeEndring]);

  function handleSorter(kolonneId: string) {
    if (sorterKolonne === kolonneId) {
      setSorterRetning((r) => (r === "asc" ? "desc" : "asc"));
    } else {
      setSorterKolonne(kolonneId);
      setSorterRetning("asc");
    }
  }

  const sortertData = useMemo(() => {
    if (!sorterKolonne) return data;
    const kol = kolonner.find((k) => k.id === sorterKolonne);
    if (!kol?.sorterVerdi) return data;

    return [...data].sort((a, b) => {
      const va = kol.sorterVerdi!(a);
      const vb = kol.sorterVerdi!(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      const cmp = typeof va === "string" && typeof vb === "string"
        ? va.localeCompare(vb, "nb-NO")
        : Number(va) - Number(vb);
      return sorterRetning === "asc" ? cmp : -cmp;
    });
  }, [data, sorterKolonne, sorterRetning, kolonner]);

  if (data.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-gray-500">
        {tomMelding}
      </div>
    );
  }

  const alleNokler = sortertData.map(radNokkel);
  const antallValgte = valgteRader?.size ?? 0;
  const alleValgt = antallValgte === data.length && data.length > 0;
  const noenValgt = antallValgte > 0 && !alleValgt;

  function toggleAlleRader() {
    if (!onValgEndring) return;
    if (alleValgt) {
      onValgEndring(new Set());
    } else {
      onValgEndring(new Set(alleNokler));
    }
  }

  function toggleRad(nokkel: string) {
    if (!onValgEndring || !valgteRader) return;
    const nyttSett = new Set(valgteRader);
    if (nyttSett.has(nokkel)) {
      nyttSett.delete(nokkel);
    } else {
      nyttSett.add(nokkel);
    }
    onValgEndring(nyttSett);
  }

  return (
    <div className="overflow-auto rounded-lg border border-gray-200 bg-white" style={resizeKolId ? { cursor: "col-resize" } : undefined}>
      <table className="w-full text-left text-sm" style={{ tableLayout: "fixed" }}>
        <thead className="sticky top-0 border-b-2 border-gray-200 bg-gray-100">
          <tr>
            {velgbar && (
              <th className="w-10 px-3 py-2.5">
                <IndeterminateCheckbox
                  checked={alleValgt}
                  indeterminate={noenValgt}
                  onChange={toggleAlleRader}
                />
              </th>
            )}
            {kolonner.map((kol) => {
              const lagretBredde = kolonneBredder?.[kol.id];
              const stilBredde = lagretBredde ? `${lagretBredde}px` : kol.bredde;
              return (
                <th
                  key={kol.id}
                  ref={(el) => { thRefs.current[kol.id] = el; }}
                  className={`relative px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500 ${
                    kol.sorterbar ? "cursor-pointer select-none hover:text-gray-700" : ""
                  }`}
                  style={stilBredde ? { width: stilBredde } : undefined}
                  onClick={kol.sorterbar ? () => handleSorter(kol.id) : undefined}
                >
                  <span className="inline-flex items-center gap-0.5">
                    {kol.header}
                    {kol.sorterbar && sorterKolonne === kol.id && (
                      sorterRetning === "asc"
                        ? <SorterPilOpp />
                        : <SorterPilNed />
                    )}
                    {kol.filtrerbar && kol.filterAlternativer && onFilterEndring && (
                      <FilterDropdown
                        alternativer={kol.filterAlternativer}
                        verdi={filterVerdier?.[kol.id] ?? ""}
                        onChange={(v) => onFilterEndring(kol.id, v)}
                      />
                    )}
                  </span>
                  {/* Resize-håndtak */}
                  <div
                    onMouseDown={(e) => handleResizeStart(e, kol.id)}
                    className={`absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400 ${
                      resizeKolId === kol.id ? "bg-blue-400" : ""
                    }`}
                  />
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sortertData.map((rad) => {
            const nokkel = radNokkel(rad);
            const erValgt = valgteRader?.has(nokkel) ?? false;
            return (
              <tr
                key={nokkel}
                onClick={() => onRadKlikk?.(rad)}
                onDoubleClick={() => onRadDobbeltklikk?.(rad)}
                className={`transition-colors ${
                  erValgt ? "bg-blue-50" : ""
                } ${
                  onRadKlikk || onRadDobbeltklikk
                    ? "cursor-pointer hover:bg-blue-50"
                    : ""
                }`}
              >
                {velgbar && (
                  <td className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      checked={erValgt}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleRad(nokkel);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                )}
                {kolonner.map((kol) => (
                  <td key={kol.id} className="px-4 py-3">
                    {kol.celle(rad)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
