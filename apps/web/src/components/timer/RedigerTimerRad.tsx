"use client";

// T7-2b2 (2026-05-14): Inline-form for én timer-rad i edit-modus.

import { useEffect, useState } from "react";
import { Split, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { rundTilNarmeste } from "@/lib/tidsrunding";
import type { RedigerTimerRadData, ProsjektValg } from "./rediger-types";

type Props = {
  rad: RedigerTimerRadData;
  prosjekter: ProsjektValg[];
  /** T.5: null = ingen runding. Verdier 15/30/60. */
  tidsrundingMinutter: number | null;
  onChange: (felt: Partial<RedigerTimerRadData>) => void;
  onSlett: () => void;
  /** T7-2c3: hvis satt, vis Splitt-knapp som kaller denne. */
  onSplitt?: () => void;
};

export function RedigerTimerRad({
  rad,
  prosjekter,
  tidsrundingMinutter,
  onChange,
  onSlett,
  onSplitt,
}: Props) {
  const { t } = useTranslation();
  const { data: lonnsarter } = trpc.timer.lonnsart.list.useQuery();
  const { data: aktiviteter } = trpc.timer.aktivitet.list.useQuery();
  const { data: ecoListe } = trpc.eksternKostObjekt.list.useQuery(
    { projectId: rad.projectId },
    { enabled: !!rad.projectId },
  );

  // T7-2e: lokal string-state for timer-input slik at desimaler kan skrives uten
  // at controlled input-loopen «spiser» punktum. Parent oppdateres først ved blur.
  const [timerStr, setTimerStr] = useState(String(rad.timer));
  useEffect(() => {
    setTimerStr(String(rad.timer));
  }, [rad.timer]);

  // T7-2e: tving step ≤ 1800 (30 min) slik at minutt-selektor alltid vises selv
  // om firmaet har tidsrunding på 60 min — Chrome skjuler minutter ved step=3600.
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
        step={timeStep}
        onChange={(e) => onChange({ fraTid: e.target.value || null })}
        onBlur={(e) => {
          // T.5: fallback-runding for nettlesere som ignorerer step-attributtet.
          if (tidsrundingMinutter && e.target.value) {
            const rundet = rundTilNarmeste(e.target.value, tidsrundingMinutter);
            if (rundet !== e.target.value) onChange({ fraTid: rundet });
          }
        }}
        className="col-span-1 min-w-[120px] rounded border border-gray-300 px-1 py-1 text-xs"
        placeholder="HH:MM"
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
        placeholder="HH:MM"
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
