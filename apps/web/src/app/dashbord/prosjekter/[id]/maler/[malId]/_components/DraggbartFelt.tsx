"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { REPORT_OBJECT_TYPE_META, type ReportObjectType } from "@siteflow/shared";
import { Badge } from "@siteflow/ui";

export interface MalObjekt {
  id: string;
  type: string;
  label: string;
  required: boolean;
  sortOrder: number;
  config: Record<string, unknown>;
}

interface DraggbartFeltProps {
  objekt: MalObjekt;
  erValgt: boolean;
  onClick: () => void;
  onSlett: () => void;
}

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

export function DraggbartFelt({ objekt, erValgt, onClick, onSlett }: DraggbartFeltProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: objekt.id,
    data: { objekt, fraKilde: "sone" },
  });

  const stil = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const meta = REPORT_OBJECT_TYPE_META[objekt.type as ReportObjectType];

  return (
    <div
      ref={setNodeRef}
      style={stil}
      className={`flex items-center gap-3 rounded-lg border bg-white px-3 py-2.5 transition-all ${
        isDragging ? "z-50 opacity-50 shadow-lg" : ""
      } ${erValgt ? "border-blue-500 ring-1 ring-blue-500" : "border-gray-200 hover:border-gray-300"}`}
    >
      {/* Drag-håndtak */}
      <button
        type="button"
        className="flex cursor-grab touch-none items-center text-gray-400 hover:text-gray-600 active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="5" cy="3" r="1.5" />
          <circle cx="11" cy="3" r="1.5" />
          <circle cx="5" cy="8" r="1.5" />
          <circle cx="11" cy="8" r="1.5" />
          <circle cx="5" cy="13" r="1.5" />
          <circle cx="11" cy="13" r="1.5" />
        </svg>
      </button>

      {/* Ikon */}
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-100 text-xs">
        {meta ? ikonMap[meta.icon] ?? "?" : "?"}
      </span>

      {/* Innhold — klikk for å velge */}
      <button
        type="button"
        className="flex flex-1 flex-col items-start text-left"
        onClick={onClick}
      >
        <span className="text-sm font-medium text-gray-800">{objekt.label}</span>
        <span className="text-xs text-gray-400">
          {meta?.label ?? objekt.type}
        </span>
      </button>

      {/* Badges og slett */}
      <div className="flex items-center gap-2">
        {objekt.required && <Badge variant="warning">Påkrevd</Badge>}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSlett();
          }}
          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
          title="Slett objekt"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
