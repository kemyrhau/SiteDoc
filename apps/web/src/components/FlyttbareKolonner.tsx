"use client";

import type { ReactNode } from "react";
import { GripVertical } from "lucide-react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { KolonneHode } from "@sitedoc/ui";
import { flyttKolonne } from "@/lib/kolonneRekkefolge";

/**
 * Flyttbare kolonner i tabellhodet (sjekklister og oppgaver). Samme dnd-kit-mønster som
 * mengde/spec-post-tabell.tsx: et lite grep-håndtak per overskrift, som ikke tar klikk for
 * sortering, bredde-dragning eller filterikonet. Tastatur: fokus på håndtaket, mellomrom
 * plukker opp, piltaster flytter, mellomrom slipper.
 *
 * Bruk: pakk `<Table>` i `<FlyttbareKolonner>` og send `renderFlyttbartHode(...)` som
 * `renderKolonneHode`.
 */

export function FlyttbareKolonner({
  kolonneIder, rekkefolge, onRekkefolgeEndring, children,
}: {
  /** Kolonnene som vises i hodet, i visningsrekkefølge. */
  kolonneIder: string[];
  /** Hele den lagrede rekkefølgen (aktive kolonner). */
  rekkefolge: string[];
  onRekkefolgeEndring: (ny: string[]) => void;
  children: ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    onRekkefolgeEndring(flyttKolonne(rekkefolge, String(active.id), String(over.id)));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={kolonneIder} strategy={horizontalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

function FlyttbartHode({ hode, flyttEtikett }: { hode: KolonneHode; flyttEtikett: string }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: hode.kolonneId });
  const { ref, style, className, onClick } = hode.thProps;
  return (
    <th
      ref={(el) => { ref(el); setNodeRef(el); }}
      className={`group ${className}`}
      style={{ ...style, transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.6 : 1, zIndex: isDragging ? 20 : undefined }}
      onClick={onClick}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        aria-label={flyttEtikett}
        title={flyttEtikett}
        className="absolute left-0.5 top-1/2 -translate-y-1/2 cursor-grab touch-none rounded text-gray-300 opacity-0 hover:text-gray-600 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 group-hover:opacity-100 active:cursor-grabbing"
      >
        <GripVertical className="h-3 w-3" />
      </button>
      {hode.innhold}
    </th>
  );
}

/** `renderKolonneHode` for `<Table>`. `flyttEtikett` gir aria-label/title via t(). */
export function renderFlyttbartHode(flyttEtikett: (kolonnenavn: string) => string) {
  return function FlyttbartHodeRender(hode: KolonneHode) {
    return <FlyttbartHode hode={hode} flyttEtikett={flyttEtikett(hode.header)} />;
  };
}
