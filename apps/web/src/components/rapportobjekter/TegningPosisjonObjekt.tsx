"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Target } from "lucide-react";
import type { RapportObjektProps } from "./typer";
import type { TegningPosisjonVerdi } from "@siteflow/shared";

export function TegningPosisjonObjekt({
  objekt,
  verdi,
  onEndreVerdi,
  leseModus,
  prosjektId,
}: RapportObjektProps) {
  const posisjon = verdi as TegningPosisjonVerdi | null;
  const [valgtTegningId, setValgtTegningId] = useState<string | null>(
    posisjon?.drawingId ?? null,
  );

  const config = objekt.config;
  const bygningsFilter = config.buildingFilter as string | null;
  const disiplinFilter = config.disciplineFilter as string | null;

  const { data: tegninger } = trpc.tegning.hentForProsjekt.useQuery(
    {
      projectId: prosjektId!,
      ...(bygningsFilter ? { buildingId: bygningsFilter } : {}),
      ...(disiplinFilter ? { discipline: disiplinFilter } : {}),
    },
    { enabled: !!prosjektId },
  );

  const valgtTegning = tegninger?.find((t) => t.id === valgtTegningId);

  function handleTegningValg(tegningId: string) {
    const tegning = tegninger?.find((t) => t.id === tegningId);
    if (!tegning) return;
    setValgtTegningId(tegningId);
    // Nullstill posisjon når ny tegning velges
    onEndreVerdi({
      drawingId: tegningId,
      positionX: 50,
      positionY: 50,
      drawingName: tegning.name,
    } satisfies TegningPosisjonVerdi);
  }

  function handleKlikkPåTegning(e: React.MouseEvent<HTMLDivElement>) {
    if (leseModus || !valgtTegning) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    onEndreVerdi({
      drawingId: valgtTegningId!,
      positionX: Math.round(x * 100) / 100,
      positionY: Math.round(y * 100) / 100,
      drawingName: valgtTegning.name,
    } satisfies TegningPosisjonVerdi);
  }

  if (leseModus && posisjon) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-gray-700">
          <Target className="mr-1 inline h-4 w-4 text-gray-400" />
          {posisjon.drawingName}
        </p>
        {valgtTegning?.fileUrl && (
          <div className="relative overflow-hidden rounded-lg border border-gray-200">
            <img
              src={valgtTegning.fileUrl}
              alt={posisjon.drawingName}
              className="w-full"
            />
            <div
              className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-red-500 shadow"
              style={{
                left: `${posisjon.positionX}%`,
                top: `${posisjon.positionY}%`,
              }}
            />
          </div>
        )}
        <p className="text-xs text-gray-500">
          Posisjon: {posisjon.positionX.toFixed(1)}%, {posisjon.positionY.toFixed(1)}%
        </p>
      </div>
    );
  }

  if (leseModus && !posisjon) {
    return (
      <p className="text-sm text-gray-400 italic">Ingen posisjon valgt</p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Tegningsvelger */}
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">
          Velg tegning
        </label>
        <select
          value={valgtTegningId ?? ""}
          onChange={(e) => handleTegningValg(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">— Velg tegning —</option>
          {tegninger?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.drawingNumber ? `${t.drawingNumber} — ` : ""}
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {/* Tegning med klikkbar markør */}
      {valgtTegning?.fileUrl && (
        <div
          className="relative cursor-crosshair overflow-hidden rounded-lg border border-gray-200"
          onClick={handleKlikkPåTegning}
        >
          <img
            src={valgtTegning.fileUrl}
            alt={valgtTegning.name}
            className="w-full"
            draggable={false}
          />
          {posisjon && posisjon.drawingId === valgtTegningId && (
            <div
              className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-red-500 shadow"
              style={{
                left: `${posisjon.positionX}%`,
                top: `${posisjon.positionY}%`,
              }}
            />
          )}
          <p className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
            Klikk for å plassere markør
          </p>
        </div>
      )}

      {posisjon && (
        <p className="text-xs text-gray-500">
          <Target className="mr-1 inline h-3 w-3" />
          {posisjon.drawingName} — {posisjon.positionX.toFixed(1)}%, {posisjon.positionY.toFixed(1)}%
        </p>
      )}
    </div>
  );
}
