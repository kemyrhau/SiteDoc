"use client";

// T7-2b2 (2026-05-14): Inline-form for én timer-rad i edit-modus.

import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import type { RedigerTimerRadData, ProsjektValg } from "./rediger-types";

type Props = {
  rad: RedigerTimerRadData;
  prosjekter: ProsjektValg[];
  onChange: (felt: Partial<RedigerTimerRadData>) => void;
  onSlett: () => void;
};

export function RedigerTimerRad({ rad, prosjekter, onChange, onSlett }: Props) {
  const { t } = useTranslation();
  const { data: lonnsarter } = trpc.timer.lonnsart.list.useQuery();
  const { data: aktiviteter } = trpc.timer.aktivitet.list.useQuery();
  const { data: ecoListe } = trpc.eksternKostObjekt.list.useQuery(
    { projectId: rad.projectId },
    { enabled: !!rad.projectId },
  );

  return (
    <div className="grid grid-cols-12 gap-2 rounded border border-gray-200 bg-gray-50 p-2 text-sm">
      <select
        value={rad.projectId}
        onChange={(e) => onChange({ projectId: e.target.value })}
        className="col-span-3 rounded border border-gray-300 px-2 py-1 text-xs"
      >
        {prosjekter.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <select
        value={rad.lonnsartId}
        onChange={(e) => onChange({ lonnsartId: e.target.value })}
        className="col-span-2 rounded border border-gray-300 px-2 py-1 text-xs"
      >
        <option value="">{t("timer.rediger.lonnsartPlaceholder")}</option>
        {lonnsarter?.map((l) => (
          <option key={l.id} value={l.id}>
            {l.navn}
          </option>
        ))}
      </select>

      <select
        value={rad.aktivitetId}
        onChange={(e) => onChange({ aktivitetId: e.target.value })}
        className="col-span-2 rounded border border-gray-300 px-2 py-1 text-xs"
      >
        <option value="">{t("timer.rediger.aktivitetPlaceholder")}</option>
        {aktiviteter?.map((a) => (
          <option key={a.id} value={a.id}>
            {a.navn}
          </option>
        ))}
      </select>

      <select
        value={rad.externalCostObjectId ?? ""}
        onChange={(e) =>
          onChange({ externalCostObjectId: e.target.value || null })
        }
        className="col-span-2 rounded border border-gray-300 px-2 py-1 text-xs"
      >
        <option value="">{t("timer.attestering.flyttEco.ingenEco")}</option>
        {ecoListe?.map((eco) => (
          <option key={eco.id} value={eco.id}>
            {eco.proAdmId} · {eco.kortNavn}
          </option>
        ))}
      </select>

      <input
        type="time"
        value={rad.fraTid ?? ""}
        onChange={(e) => onChange({ fraTid: e.target.value || null })}
        className="col-span-1 rounded border border-gray-300 px-1 py-1 text-xs"
        placeholder="HH:MM"
      />
      <input
        type="time"
        value={rad.tilTid ?? ""}
        onChange={(e) => onChange({ tilTid: e.target.value || null })}
        className="col-span-1 rounded border border-gray-300 px-1 py-1 text-xs"
        placeholder="HH:MM"
      />

      <input
        type="number"
        step="0.25"
        min="0"
        value={rad.timer}
        onChange={(e) => onChange({ timer: Number(e.target.value) || 0 })}
        className="col-span-1 rounded border border-gray-300 px-2 py-1 text-right text-xs font-mono"
      />

      <button
        type="button"
        onClick={onSlett}
        className="col-span-12 -mt-1 flex items-center justify-end gap-1 text-xs text-red-600 hover:text-red-800"
        aria-label={t("timer.rediger.slettRad")}
      >
        <Trash2 className="h-3 w-3" />
        {t("timer.rediger.slettRad")}
      </button>
    </div>
  );
}
