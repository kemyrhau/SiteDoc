"use client";

// T7-2b2 (2026-05-14): Inline-form for én tillegg-rad i edit-modus.

import { Split, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import type { RedigerTilleggRadData, ProsjektValg } from "./rediger-types";

type Props = {
  rad: RedigerTilleggRadData;
  prosjekter: ProsjektValg[];
  onChange: (felt: Partial<RedigerTilleggRadData>) => void;
  onSlett: () => void;
  /** T7-2c3: hvis satt, vis Splitt-knapp som kaller denne. */
  onSplitt?: () => void;
};

export function RedigerTilleggRad({ rad, prosjekter, onChange, onSlett, onSplitt }: Props) {
  const { t } = useTranslation();
  const { data: tilleggKatalog } = trpc.timer.tillegg.list.useQuery();

  return (
    <div className="grid grid-cols-12 gap-2 rounded border border-gray-200 bg-gray-50 p-2 text-sm">
      <select
        value={rad.projectId}
        onChange={(e) => onChange({ projectId: e.target.value })}
        className="col-span-4 rounded border border-gray-300 px-2 py-1 text-xs"
      >
        {prosjekter.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <select
        value={rad.tilleggId}
        onChange={(e) => onChange({ tilleggId: e.target.value })}
        className="col-span-3 rounded border border-gray-300 px-2 py-1 text-xs"
      >
        <option value="">{t("timer.rediger.tilleggPlaceholder")}</option>
        {tilleggKatalog?.map((t) => (
          <option key={t.id} value={t.id}>
            {t.navn}
          </option>
        ))}
      </select>

      <input
        type="number"
        step="0.25"
        min="0"
        value={rad.antall}
        onChange={(e) => onChange({ antall: Number(e.target.value) || 0 })}
        className="col-span-2 rounded border border-gray-300 px-2 py-1 text-right text-xs font-mono"
      />

      <input
        type="text"
        value={rad.kommentar ?? ""}
        onChange={(e) => onChange({ kommentar: e.target.value || null })}
        placeholder={t("timer.rediger.kommentarPlaceholder")}
        className="col-span-3 rounded border border-gray-300 px-2 py-1 text-xs"
      />

      <div className="col-span-12 -mt-1 flex items-center justify-end gap-3">
        {onSplitt && (
          <button
            type="button"
            onClick={onSplitt}
            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800"
            aria-label={t("timer.rediger.splittRad")}
          >
            <Split className="h-3 w-3" />
            {t("timer.rediger.splittRad")}
          </button>
        )}
        <button
          type="button"
          onClick={onSlett}
          className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800"
          aria-label={t("timer.rediger.slettRad")}
        >
          <Trash2 className="h-3 w-3" />
          {t("timer.rediger.slettRad")}
        </button>
      </div>
    </div>
  );
}
