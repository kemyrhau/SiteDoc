"use client";

// T7-2b2 (2026-05-14): Inline-form for én maskin-rad i edit-modus.

import { useEffect, useState } from "react";
import { Split, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { rundTilNarmeste } from "@/lib/tidsrunding";
import type { RedigerMaskinRadData, ProsjektValg } from "./rediger-types";

type Props = {
  rad: RedigerMaskinRadData;
  prosjekter: ProsjektValg[];
  /** T.5: null = ingen runding. Verdier 15/30/60. */
  tidsrundingMinutter: number | null;
  onChange: (felt: Partial<RedigerMaskinRadData>) => void;
  onSlett: () => void;
  /** T7-2c3: hvis satt, vis Splitt-knapp som kaller denne. */
  onSplitt?: () => void;
};

export function RedigerMaskinRad({
  rad,
  prosjekter,
  tidsrundingMinutter,
  onChange,
  onSlett,
  onSplitt,
}: Props) {
  const { t } = useTranslation();
  const { data: equipmentRaw } = trpc.maskin.equipment.list.useQuery();
  const equipment = equipmentRaw as unknown as
    | Array<{ id: string; merke: string; modell: string; internNavn: string | null }>
    | undefined;

  // T7-4d: ECO-katalog for prosjektet — maskin følger samme prosjekt+ECO-gruppe
  // som arbeidstimer (T.7 låst 2026-05-16). Server tar imot externalCostObjectId
  // fra T7-4b.
  const { data: ecoer } = trpc.eksternKostObjekt.list.useQuery(
    { projectId: rad.projectId },
    { enabled: !!rad.projectId },
  );

  // T7-2e: lokal string-state for timer-input (samme mønster som RedigerTimerRad).
  const [timerStr, setTimerStr] = useState(String(rad.timer));
  useEffect(() => {
    setTimerStr(String(rad.timer));
  }, [rad.timer]);

  // T7-2e: tving step ≤ 1800 (30 min) slik at minutt-selektor alltid vises.
  const timeStep = Math.min((tidsrundingMinutter ?? 15) * 60, 1800);

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
        value={rad.vehicleId}
        onChange={(e) => onChange({ vehicleId: e.target.value })}
        className="col-span-3 rounded border border-gray-300 px-2 py-1 text-xs"
      >
        <option value="">{t("timer.rediger.maskinPlaceholder")}</option>
        {equipment?.map((e) => (
          <option key={e.id} value={e.id}>
            {e.merke} {e.modell}
            {e.internNavn ? ` (${e.internNavn})` : ""}
          </option>
        ))}
      </select>

      <input
        type="time"
        value={rad.fraTid ?? ""}
        step={timeStep}
        onChange={(e) => onChange({ fraTid: e.target.value || null })}
        onBlur={(e) => {
          if (tidsrundingMinutter && e.target.value) {
            const rundet = rundTilNarmeste(e.target.value, tidsrundingMinutter);
            if (rundet !== e.target.value) onChange({ fraTid: rundet });
          }
        }}
        className="col-span-1 min-w-[120px] rounded border border-gray-300 px-1 py-1 text-xs"
      />
      <input
        type="time"
        value={rad.tilTid ?? ""}
        step={timeStep}
        onChange={(e) => onChange({ tilTid: e.target.value || null })}
        onBlur={(e) => {
          if (tidsrundingMinutter && e.target.value) {
            const rundet = rundTilNarmeste(e.target.value, tidsrundingMinutter);
            if (rundet !== e.target.value) onChange({ tilTid: rundet });
          }
        }}
        className="col-span-1 min-w-[120px] rounded border border-gray-300 px-1 py-1 text-xs"
      />

      <input
        type="number"
        step="0.25"
        min="0"
        value={timerStr}
        onChange={(e) => setTimerStr(e.target.value)}
        onBlur={() => {
          const parsed = parseFloat(timerStr);
          if (!isNaN(parsed) && parsed >= 0) {
            if (parsed !== rad.timer) onChange({ timer: parsed });
          } else {
            setTimerStr(String(rad.timer));
          }
        }}
        className="col-span-1 rounded border border-gray-300 px-2 py-1 text-right text-xs font-mono"
        title={t("timer.timerEnhet")}
      />

      <input
        type="number"
        step="0.01"
        min="0"
        value={rad.mengde ?? ""}
        onChange={(e) =>
          onChange({ mengde: e.target.value === "" ? null : Number(e.target.value) })
        }
        placeholder={t("timer.rediger.mengdePlaceholder")}
        className="col-span-2 rounded border border-gray-300 px-2 py-1 text-right text-xs font-mono"
      />

      <select
        value={rad.enhet ?? ""}
        onChange={(e) => onChange({ enhet: e.target.value || null })}
        className="col-span-1 rounded border border-gray-300 px-1 py-1 text-xs"
      >
        <option value="">—</option>
        <option value="m">m</option>
        <option value="m2">m²</option>
        <option value="m3">m³</option>
        <option value="kg">kg</option>
        <option value="tonn">tonn</option>
        <option value="stk">stk</option>
      </select>

      {/* T7-4d: ECO-velger + action-knapper på samme rad for plass-effektivitet. */}
      <div className="col-span-12 -mt-1 flex items-center gap-2 pt-1">
        <label className="text-xs font-medium text-gray-600">
          {t("timer.felt.underprosjekt")}:
        </label>
        <select
          value={rad.externalCostObjectId ?? ""}
          onChange={(e) =>
            onChange({ externalCostObjectId: e.target.value || null })
          }
          className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs"
        >
          <option value="">—</option>
          {ecoer?.map((eco) => (
            <option key={eco.id} value={eco.id}>
              {eco.proAdmId} · {eco.kortNavn}
            </option>
          ))}
        </select>
        {rad.externalCostObjectId && (
          <button
            type="button"
            onClick={() => onChange({ externalCostObjectId: null })}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            title={t("handling.fjern")}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
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
