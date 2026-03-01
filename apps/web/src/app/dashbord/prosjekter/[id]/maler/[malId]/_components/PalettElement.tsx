"use client";

import { useDraggable } from "@dnd-kit/core";
import type { ReportObjectType, ReportObjectTypeMeta } from "@siteflow/shared";

interface PalettElementProps {
  type: ReportObjectType;
  meta: ReportObjectTypeMeta;
}

// Ikon-map med enkle tekst-representasjoner (Lucide-ikonnavn → korte symboler)
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

export function PalettElement({ type, meta }: PalettElementProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palett-${type}`,
    data: { type, fraKilde: "palett" },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex cursor-grab items-center gap-2.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm transition-all hover:border-blue-300 hover:shadow-sm active:cursor-grabbing ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-100 text-xs">
        {ikonMap[meta.icon] ?? "?"}
      </span>
      <span className="truncate font-medium text-gray-700">{meta.label}</span>
    </div>
  );
}
