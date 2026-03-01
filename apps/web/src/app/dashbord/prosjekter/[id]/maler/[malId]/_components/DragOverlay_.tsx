"use client";

import { DragOverlay as DndDragOverlay } from "@dnd-kit/core";
import type { Active } from "@dnd-kit/core";
import { REPORT_OBJECT_TYPE_META, type ReportObjectType } from "@siteflow/shared";
import type { MalObjekt } from "./DraggbartFelt";

const ikonMap: Record<string, string> = {
  Heading: "H",
  Type: "T",
  AlignLeft: "Aa",
  CircleDot: "●",
  ListChecks: "☑",
  Hash: "#",
  Percent: "%",
  Calculator: "Σ",
  Calendar: "📅",
  Clock: "🕐",
  User: "👤",
  Users: "👥",
  Building2: "🏢",
  Paperclip: "📎",
  Box: "◻",
  Map: "🗺",
  DoorOpen: "🚪",
  CloudSun: "☁",
  PenLine: "✍",
  Repeat: "↻",
};

interface DragOverlayProps {
  aktivt: Active | null;
}

export function DragOverlayKomponent({ aktivt }: DragOverlayProps) {
  if (!aktivt) return <DndDragOverlay />;

  const data = aktivt.data.current;

  // Fra paletten — vise feltkort
  if (data?.fraKilde === "palett") {
    const type = data.type as ReportObjectType;
    const meta = REPORT_OBJECT_TYPE_META[type];
    return (
      <DndDragOverlay>
        <div className="flex w-56 items-center gap-2.5 rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm shadow-lg">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-100 text-xs">
            {ikonMap[meta.icon] ?? "?"}
          </span>
          <span className="truncate font-medium text-gray-700">{meta.label}</span>
        </div>
      </DndDragOverlay>
    );
  }

  // Fra sone — vise eksisterende felt
  if (data?.fraKilde === "sone") {
    const objekt = data.objekt as MalObjekt;
    const meta = REPORT_OBJECT_TYPE_META[objekt.type as ReportObjectType];
    return (
      <DndDragOverlay>
        <div className="flex items-center gap-3 rounded-lg border border-blue-300 bg-white px-3 py-2.5 shadow-lg">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-100 text-xs">
            {meta ? ikonMap[meta.icon] ?? "?" : "?"}
          </span>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-800">{objekt.label}</span>
            <span className="text-xs text-gray-400">{meta?.label ?? objekt.type}</span>
          </div>
        </div>
      </DndDragOverlay>
    );
  }

  return <DndDragOverlay />;
}
