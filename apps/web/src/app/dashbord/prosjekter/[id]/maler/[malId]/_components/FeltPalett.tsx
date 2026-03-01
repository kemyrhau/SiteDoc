"use client";

import {
  REPORT_OBJECT_TYPES,
  REPORT_OBJECT_TYPE_META,
  type ReportObjectCategory,
} from "@siteflow/shared";
import { PalettElement } from "./PalettElement";

const kategoriLabels: Record<ReportObjectCategory, string> = {
  tekst: "Tekst",
  valg: "Valg",
  tall: "Tall",
  dato: "Dato / Tid",
  person: "Person / Firma",
  fil: "Filer",
  spesial: "Spesialfelt",
};

const kategoriRekkefølge: ReportObjectCategory[] = [
  "tekst",
  "valg",
  "tall",
  "dato",
  "person",
  "fil",
  "spesial",
];

export function FeltPalett() {
  const gruppert = kategoriRekkefølge.map((kategori) => ({
    kategori,
    label: kategoriLabels[kategori],
    typer: REPORT_OBJECT_TYPES.filter(
      (type) => REPORT_OBJECT_TYPE_META[type].category === kategori,
    ),
  }));

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col overflow-y-auto border-r border-gray-200 bg-gray-50 p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
        Felttyper
      </h3>
      <div className="flex flex-col gap-4">
        {gruppert.map(({ kategori, label, typer }) => (
          <div key={kategori}>
            <p className="mb-1.5 text-xs font-medium text-gray-400">{label}</p>
            <div className="flex flex-col gap-1.5">
              {typer.map((type) => (
                <PalettElement
                  key={type}
                  type={type}
                  meta={REPORT_OBJECT_TYPE_META[type]}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
