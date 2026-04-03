"use client";

import { useDraggable } from "@dnd-kit/core";
import type { ReportObjectType, ReportObjectTypeMeta } from "@sitedoc/shared";
import { useTranslation } from "react-i18next";

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
  SquareCheck: "☐",
  ListChecks: "☑",
  List: "≡",
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
  FileText: "📄",
  Image: "🖼",
  Play: "▶",
  HelpCircle: "❓",
};

// i18n-nøkler for felttyper (type → nøkkel)
const felttypeNokler: Record<string, string> = {
  heading: "malbygger.overskrift",
  subtitle: "malbygger.undertittel",
  text_field: "malbygger.tekstfelt",
  list_single: "malbygger.enkeltvalg",
  list_multi: "malbygger.flervalg",
  traffic_light: "malbygger.trafikklys",
  integer: "malbygger.heltall",
  decimal: "malbygger.desimaltall",
  calculation: "malbygger.beregning",
  date: "malbygger.dato_felt",
  date_time: "malbygger.datoOgTid",
  person: "malbygger.personFelt",
  persons: "malbygger.flerePersoner",
  company: "malbygger.firma",
  attachments: "malbygger.vedlegg",
  bim_property: "malbygger.bimEgenskap",
  zone_property: "malbygger.soneEgenskap",
  room_property: "malbygger.romEgenskap",
  weather: "malbygger.vaer",
  signature: "malbygger.signatur",
  repeater: "malbygger.repeater",
  info_text: "malbygger.lesetekst",
  info_image: "malbygger.bildeMedTekst",
  video: "malbygger.video",
  quiz: "malbygger.quiz",
};

export function PalettElement({ type, meta }: PalettElementProps) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palett-${type}`,
    data: { type, fraKilde: "palett" },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex cursor-grab items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs transition-all hover:border-blue-300 hover:shadow-sm active:cursor-grabbing ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gray-100 text-[11px]">
        {ikonMap[meta.icon] ?? "?"}
      </span>
      <span className="truncate font-medium text-gray-700">{felttypeNokler[type] ? t(felttypeNokler[type]) : meta.label}</span>
    </div>
  );
}
