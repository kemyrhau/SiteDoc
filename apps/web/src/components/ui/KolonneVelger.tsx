"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, GripVertical, Search, X } from "lucide-react";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/**
 * Delt kolonnevelger-panel. PRESENTASJON — ingen persistens. Tre flater wirer den til
 * hver sin datakilde: sjekklister/oppgaver til `useTabelloppsett` (per bruker),
 * timer-rapporten til malens `config.kolonner` (per mal). Erstatter to inline-kopier
 * i sjekklister/oppgaver + gir timer-rapporten en velger den ikke hadde.
 *
 * To modi:
 *  - Uten `sorterbar`: grupperte avhukinger + søk (dagens sjekk/oppgave-atferd).
 *  - Med `sorterbar`: valgte kolonner ligger øverst som en draggbar liste (rekkefølgen
 *    settes her, ikke bare i tabellhodet); tilgjengelige kolonner ligger under som
 *    avhukinger. Låste kolonner (f.eks. Dato) kan flyttes, men ikke fjernes.
 */

export interface KolonneVelgerFelt {
  id: string;
  /** Ferdig oversatt etikett (kaller ikke t() selv). */
  navn: string;
  /** Alltid-på: vises avhuket, kan ikke fjernes. */
  laast?: boolean;
}

export interface KolonneVelgerGruppe {
  id: string;
  /** Ferdig oversatt gruppenavn. */
  navn: string;
  felter: KolonneVelgerFelt[];
}

interface KolonneVelgerProps {
  apen: boolean;
  onLukk: () => void;
  /** Ids for aktive kolonner. */
  aktive: Set<string>;
  /** Toggle én kolonne. `"__reset__"` nullstiller til standard. */
  onToggle: (id: string) => void;
  grupper: KolonneVelgerGruppe[];
  sokPlaceholder: string;
  nullstillTekst: string;
  okTekst: string;
  sokIngenTekst?: string;
  /** Slå på drag-rekkefølge. Krever `rekkefolge` + `onRekkefolgeEndring`. */
  sorterbar?: boolean;
  /** Gjeldende rekkefølge (kun aktive kolonner, i visningsrekkefølge). */
  rekkefolge?: string[];
  onRekkefolgeEndring?: (ny: string[]) => void;
}

function SorterbarRad({
  felt, onFjern,
}: {
  felt: KolonneVelgerFelt; onFjern: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: felt.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded py-1 pl-1 pr-2 text-xs hover:bg-gray-50"
    >
      <button
        type="button"
        className="cursor-grab touch-none text-gray-400 hover:text-gray-600 active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label="Flytt kolonne"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <span className="flex-1 truncate">{felt.navn}</span>
      {felt.laast ? (
        <span className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <button
          type="button"
          onClick={() => onFjern(felt.id)}
          className="text-gray-400 hover:text-gray-700"
          aria-label={`Fjern ${felt.navn}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function KolonneVelger({
  apen, onLukk, aktive, onToggle, grupper, sokPlaceholder, nullstillTekst, okTekst, sokIngenTekst,
  sorterbar, rekkefolge, onRekkefolgeEndring,
}: KolonneVelgerProps) {
  const [sok, setSok] = useState("");
  const [apneGrupper, setApneGrupper] = useState<Set<string>>(new Set(grupper.map((g) => g.id)));
  const ref = useRef<HTMLDivElement>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  useEffect(() => {
    function handleKlikk(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onLukk();
    }
    if (apen) document.addEventListener("mousedown", handleKlikk);
    return () => document.removeEventListener("mousedown", handleKlikk);
  }, [apen, onLukk]);

  const alleFelter = useMemo(() => grupper.flatMap((g) => g.felter), [grupper]);
  const feltVedId = useMemo(() => new Map(alleFelter.map((f) => [f.id, f])), [alleFelter]);

  if (!apen) return null;

  const sokLower = sok.toLowerCase().trim();
  const treff = (f: KolonneVelgerFelt) => !sokLower || f.navn.toLowerCase().includes(sokLower);

  const toggleGruppe = (id: string) => {
    setApneGrupper((prev) => {
      const ny = new Set(prev);
      if (ny.has(id)) ny.delete(id); else ny.add(id);
      return ny;
    });
  };

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id || !rekkefolge || !onRekkefolgeEndring) return;
    const fra = rekkefolge.indexOf(String(active.id));
    const til = rekkefolge.indexOf(String(over.id));
    if (fra === -1 || til === -1) return;
    onRekkefolgeEndring(arrayMove(rekkefolge, fra, til));
  }

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full z-50 mt-1 flex max-h-[70vh] w-[340px] flex-col rounded-lg border border-gray-200 bg-white shadow-xl"
    >
      <div className="p-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={sok}
            onChange={(e) => setSok(e.target.value)}
            placeholder={sokPlaceholder}
            className="w-full rounded-md border border-gray-200 py-1.5 pl-8 pr-3 text-xs focus:border-blue-500 focus:outline-none"
            autoFocus
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-2">
        {sorterbar ? (
          <SorterbarInnhold
            alleFelter={alleFelter}
            feltVedId={feltVedId}
            aktive={aktive}
            rekkefolge={rekkefolge ?? []}
            onToggle={onToggle}
            treff={treff}
            sensors={sensors}
            handleDragEnd={handleDragEnd}
            sokIngenTekst={sokIngenTekst}
          />
        ) : (
          grupper
            .map((g) => ({ ...g, felter: g.felter.filter(treff) }))
            .filter((g) => g.felter.length > 0)
            .map((gruppe) => (
              <div key={gruppe.id}>
                <button
                  onClick={() => toggleGruppe(gruppe.id)}
                  className="flex w-full items-center gap-1 px-2 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  {apneGrupper.has(gruppe.id) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  {gruppe.navn}
                </button>
                {apneGrupper.has(gruppe.id) && gruppe.felter.map((felt) => (
                  <label key={felt.id} className="flex cursor-pointer items-center gap-2 py-1 pl-6 pr-2 text-xs hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={aktive.has(felt.id)}
                      disabled={felt.laast}
                      onChange={() => onToggle(felt.id)}
                      className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 disabled:opacity-50"
                    />
                    <span className="truncate">{felt.navn}</span>
                  </label>
                ))}
              </div>
            ))
        )}
      </div>

      <div className="flex items-center justify-between border-t border-gray-100 px-3 py-2">
        <button onClick={() => onToggle("__reset__")} className="text-xs text-gray-500 hover:text-gray-700">{nullstillTekst}</button>
        <button onClick={onLukk} className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700">{okTekst}</button>
      </div>
    </div>
  );
}

function SorterbarInnhold({
  alleFelter, feltVedId, aktive, rekkefolge, onToggle, treff, sensors, handleDragEnd, sokIngenTekst,
}: {
  alleFelter: KolonneVelgerFelt[];
  feltVedId: Map<string, KolonneVelgerFelt>;
  aktive: Set<string>;
  rekkefolge: string[];
  onToggle: (id: string) => void;
  treff: (f: KolonneVelgerFelt) => boolean;
  sensors: ReturnType<typeof useSensors>;
  handleDragEnd: (e: DragEndEvent) => void;
  sokIngenTekst?: string;
}) {
  // Aktive kolonner i rekkefølge (draggbare), så tilgjengelige kolonner (avhukinger).
  const aktiveFelter = rekkefolge
    .map((id) => feltVedId.get(id))
    .filter((f): f is KolonneVelgerFelt => !!f)
    .filter(treff);
  const inaktiveFelter = alleFelter.filter((f) => !aktive.has(f.id)).filter(treff);

  return (
    <div className="pb-1">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={aktiveFelter.map((f) => f.id)} strategy={verticalListSortingStrategy}>
          {aktiveFelter.map((felt) => (
            <SorterbarRad key={felt.id} felt={felt} onFjern={onToggle} />
          ))}
        </SortableContext>
      </DndContext>

      {inaktiveFelter.length > 0 && (
        <div className="mt-1 border-t border-gray-100 pt-1">
          {inaktiveFelter.map((felt) => (
            <label key={felt.id} className="flex cursor-pointer items-center gap-2 py-1 pl-6 pr-2 text-xs text-gray-500 hover:bg-gray-50">
              <input
                type="checkbox"
                checked={false}
                onChange={() => onToggle(felt.id)}
                className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600"
              />
              <span className="truncate">{felt.navn}</span>
            </label>
          ))}
        </div>
      )}

      {aktiveFelter.length === 0 && inaktiveFelter.length === 0 && sokIngenTekst && (
        <p className="px-3 py-2 text-xs text-gray-400">{sokIngenTekst}</p>
      )}
    </div>
  );
}
