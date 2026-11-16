import { Fragment, useState, useMemo, useRef, useEffect, useCallback, type CSSProperties, type ReactNode } from "react";
import {
  SorterPil,
  KolonneFilter,
  BreddeHandtak,
  useBreddeDragning,
  STANDARD_FILTER_TEKSTER,
  type SorterRetning,
  type KolonneFilterTekster,
} from "./tabellverktoy";

interface KolonneDef<T> {
  id: string;
  header: string;
  celle: (rad: T) => ReactNode;
  bredde?: string;
  sorterbar?: boolean;
  sorterVerdi?: (rad: T) => string | number | null;
  filtrerbar?: boolean;
  filterAlternativer?: { value: string; label: string }[];
  /** Snarveier rendres over alternativ-listen i filter-dropdown. Klikk setter filterverdi til verdier.join(","). */
  filterSnarveier?: { label: string; verdier: string[] }[];
}

/**
 * Default kolonnebredde når `bredde` mangler. Under `table-layout: fixed` deler
 * breddeløse kolonner restplassen og krymper mot null når mange slås på — teksten
 * renner da ut av cella og males oppå naboen. Ett tall her hindrer det for alle
 * breddeløse kolonner uten å måtte sette `bredde:` per kolonne i hver sidefil.
 * Målt mot lengste overskrift i bruk («Bestiller-faggruppe»).
 */
const DEFAULT_KOLONNE_BREDDE_PX = 160;

/** Effektiv kolonnebredde i piksler: lagret drag-bredde → eksplisitt `bredde` → default. */
function kolonneBreddePx<T>(kol: KolonneDef<T>, kolonneBredder?: Record<string, number>): number {
  const lagret = kolonneBredder?.[kol.id];
  if (typeof lagret === "number") return lagret;
  if (kol.bredde) {
    const parsed = parseInt(kol.bredde, 10);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return DEFAULT_KOLONNE_BREDDE_PX;
}

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
  /**
   * Erstatter `<th>` i hodet, for eksempel for å gjøre kolonnene flyttbare (dnd-kit bor i
   * apps/web, ikke her). Må rendre en `<th>` med `thProps` og `innhold`.
   */
  renderKolonneHode?: (hode: KolonneHode) => ReactNode;
  /** Tekster i filternedtrekket (send `t()`). Standard: dagens norske tekst. */
  tekster?: KolonneFilterTekster;
}

/** Det `renderKolonneHode` får: ferdige `<th>`-props og innholdet (tittel, sorterpil, filter, bredde-håndtak). */
export interface KolonneHode {
  kolonneId: string;
  header: string;
  thProps: {
    ref: (el: HTMLTableCellElement | null) => void;
    className: string;
    style: CSSProperties;
    onClick?: () => void;
  };
  innhold: ReactNode;
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
  renderKolonneHode,
  tekster = STANDARD_FILTER_TEKSTER,
}: TableProps<T>) {
  const [sorterKolonne, setSorterKolonne] = useState<string | null>(null);
  const [sorterRetning, setSorterRetning] = useState<SorterRetning>("asc");

  // Bredde-dragning (delt med TimerRadTabell): bredden settes direkte på <th> under
  // dragningen, og lagres samlet ved slipp.
  const lokaleBreader = useRef<Record<string, number>>({});
  const thRefs = useRef<Record<string, HTMLTableCellElement | null>>({});
  const { aktivId: resizeKolId, start: handleResizeStart } = useBreddeDragning({
    startBredde: useCallback((kolId: string) => thRefs.current[kolId]?.offsetWidth, []),
    onLive: (kolId, nyBredde) => {
      lokaleBreader.current = { ...lokaleBreader.current, [kolId]: nyBredde };
      const th = thRefs.current[kolId];
      if (th) th.style.width = `${nyBredde}px`;
    },
    onSlutt: () => {
      if (onKolonneBreddeEndring) {
        onKolonneBreddeEndring({ ...kolonneBredder, ...lokaleBreader.current });
      }
    },
  });

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

  // Min-bredde på tabellen = summen av kolonnebreddene (+ evt. velg-kolonnen).
  // Da slår wrapperens `overflow-auto` inn og gir horisontal scroll av seg selv
  // i stedet for at `w-full` presser kolonnene sammen til de males oppå hverandre.
  const minTabellBredde = useMemo(() => {
    const sum = kolonner.reduce((acc, kol) => acc + kolonneBreddePx(kol, kolonneBredder), 0);
    return sum + (velgbar ? 40 : 0);
  }, [kolonner, kolonneBredder, velgbar]);

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
      <table className="w-full text-left text-sm" style={{ tableLayout: "fixed", minWidth: `${minTabellBredde}px` }}>
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
              const stilBredde = lagretBredde ? `${lagretBredde}px` : (kol.bredde ?? `${DEFAULT_KOLONNE_BREDDE_PX}px`);
              const thProps: KolonneHode["thProps"] = {
                ref: (el) => { thRefs.current[kol.id] = el; },
                className: `relative px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500 ${
                  kol.sorterbar ? "cursor-pointer select-none hover:text-gray-700" : ""
                }`,
                style: { width: stilBredde },
                onClick: kol.sorterbar ? () => handleSorter(kol.id) : undefined,
              };
              const innhold = (
                <>
                  <span className="flex min-w-0 items-center gap-0.5">
                    <span className="truncate">{kol.header}</span>
                    {kol.sorterbar && sorterKolonne === kol.id && (
                      <SorterPil retning={sorterRetning} />
                    )}
                    {kol.filtrerbar && kol.filterAlternativer && onFilterEndring && (
                      <KolonneFilter
                        tekster={tekster}
                        alternativer={kol.filterAlternativer}
                        snarveier={kol.filterSnarveier}
                        verdi={filterVerdier?.[kol.id] ?? ""}
                        onChange={(v) => onFilterEndring(kol.id, v)}
                      />
                    )}
                  </span>
                  {/* Resize-håndtak */}
                  <BreddeHandtak aktiv={resizeKolId === kol.id} onMouseDown={(e) => handleResizeStart(e, kol.id)} />
                </>
              );
              if (renderKolonneHode) {
                return <Fragment key={kol.id}>{renderKolonneHode({ kolonneId: kol.id, header: kol.header, thProps, innhold })}</Fragment>;
              }
              return (
                <th key={kol.id} {...thProps}>
                  {innhold}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
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
                  <td key={kol.id} className="truncate px-4 py-3">
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
