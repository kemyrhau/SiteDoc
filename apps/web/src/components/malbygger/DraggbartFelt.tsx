"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { REPORT_OBJECT_TYPE_META, type ReportObjectType, erKontainerType } from "@sitedoc/shared";
import { Badge } from "@sitedoc/ui";
import { useTranslation } from "react-i18next";
import { Info } from "lucide-react";
import { TreprikkMeny } from "./TreprikkMeny";
import type { ReactNode } from "react";

export interface MalObjekt {
  id: string;
  type: string;
  label: string;
  required: boolean;
  sortOrder: number;
  config: Record<string, unknown>;
  parentId: string | null;
}

interface DraggbartFeltProps {
  objekt: MalObjekt;
  erValgt: boolean;
  nestingNivå?: number;
  onClick: () => void;
  onSlett: () => void;
  onTilfoyjBetingelse?: () => void;
  onFjernBetingelse?: () => void;
  children?: ReactNode;
}

const ikonMap: Record<string, string> = {
  Heading: "H",
  Type: "T",
  AlignLeft: "Aa",
  CircleDot: "●",
  SquareCheck: "☐",
  List: "≡",
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

export function DraggbartFelt({
  objekt,
  erValgt,
  nestingNivå = 0,
  onClick,
  onSlett,
  onTilfoyjBetingelse,
  onFjernBetingelse,
  children,
}: DraggbartFeltProps) {
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
  const { t } = useTranslation();

  const stil = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const meta = REPORT_OBJECT_TYPE_META[objekt.type as ReportObjectType];

  const erBarn = nestingNivå > 0;
  const harAktivBetingelse = objekt.config.conditionActive === true;

  // Kan ha betingelse: er kontainertype (ikke repeater), har minst én opsjon, og har ikke allerede aktiv betingelse
  const harOpsjoner = Array.isArray(objekt.config.options) && (objekt.config.options as string[]).length > 0;
  const kanHaBetingelse = erKontainerType(objekt.type) && objekt.type !== "repeater" && harOpsjoner && !harAktivBetingelse;

  return (
    <div ref={setNodeRef} style={stil}>
      <div
        className={`flex items-center gap-2 rounded-lg border bg-white px-2.5 py-1.5 transition-all ${
          isDragging ? "z-50 opacity-50 shadow-lg" : ""
        } ${
          erValgt ? "border-blue-500 ring-1 ring-blue-500" : "border-gray-200 hover:border-gray-300"
        }`}
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
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gray-100 text-[11px]">
          {meta ? ikonMap[meta.icon] ?? "?" : "?"}
        </span>

        {/* Innhold — klikk for å velge */}
        <button
          type="button"
          className="flex flex-1 flex-col items-start text-left"
          onClick={onClick}
        >
          <span className="text-xs font-medium text-gray-800">{objekt.label}</span>
          <span className="text-[11px] text-gray-400">
            {meta?.label ?? objekt.type}
          </span>
        </button>

        {/* Hjelpetekst-indikator */}
        {typeof objekt.config.helpText === "string" && objekt.config.helpText && (
          <Info size={14} className="shrink-0 text-blue-400" />
        )}

        {/* Badges og meny */}
        <div className="flex items-center gap-2">
          {erBarn && <Badge variant="default">{t("malbygger.betinget")}</Badge>}
          {objekt.required && <Badge variant="warning">{t("malbygger.paakrevd")}</Badge>}
          <TreprikkMeny
            onRediger={onClick}
            onSlett={onSlett}
            onTilfoyjBetingelse={kanHaBetingelse ? onTilfoyjBetingelse : undefined}
            onFjernBetingelse={erBarn ? onFjernBetingelse : undefined}
            kanHaBetingelse={kanHaBetingelse}
            erBarnFelt={erBarn}
          />
        </div>
      </div>

      {/* Barn rendres inline under feltet */}
      {children}
    </div>
  );
}
