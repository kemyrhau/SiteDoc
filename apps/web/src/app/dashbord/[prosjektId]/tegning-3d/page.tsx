"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { useTreDViewer } from "@/kontekst/tred-viewer-kontekst";
import {
  beregnTransformasjon,
  tegningTilGps,
  gpsTilTegning,
  gpsTil3D,
  tredjeTilGps,
} from "@sitedoc/shared/utils";
import type { GeoReferanse } from "@sitedoc/shared";
import type { KoordinatSystem } from "@sitedoc/shared/utils";
import { MapPin, Crosshair, Layers, Link2, Link2Off } from "lucide-react";

interface TegningData {
  id: string;
  name: string;
  drawingNumber: string | null;
  floor: string | null;
  fileUrl: string | null;
  fileType: string | null;
  geoReference?: unknown;
  ifcMetadata?: {
    gpsBreddegrad?: number | null;
    gpsLengdegrad?: number | null;
    etasjer?: Array<{ navn: string; høyde: number | null }>;
  } | null;
  coordinateSystem?: string | null;
}

export default function Tegning3DSide() {
  const { prosjektId } = useParams<{ prosjektId: string }>();
  const { viewerRef, valgtObjekt } = useTreDViewer();

  // Hent alle tegninger for prosjektet
  const { data: _tegninger } = trpc.tegning.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );
  const tegninger = (_tegninger ?? []) as TegningData[];

  // Filtrer: plantegninger (PDF/DWG/SVG) og IFC-modeller
  const plantegninger = tegninger.filter(
    (t) => t.fileUrl && t.fileType?.toLowerCase() !== "ifc",
  );
  const ifcModeller = tegninger.filter(
    (t) => t.fileType?.toLowerCase() === "ifc",
  );

  // Finn IFC-opprinnelse (GPS fra første IFC med metadata)
  const ifcOpprinnelse = useMemo(() => {
    for (const m of ifcModeller) {
      if (m.ifcMetadata?.gpsBreddegrad && m.ifcMetadata?.gpsLengdegrad) {
        return {
          lat: m.ifcMetadata.gpsBreddegrad,
          lng: m.ifcMetadata.gpsLengdegrad,
        };
      }
    }
    return null;
  }, [ifcModeller]);

  // Koordinatsystem
  const coordSystem: KoordinatSystem = useMemo(() => {
    for (const m of ifcModeller) {
      if (m.coordinateSystem) return m.coordinateSystem as KoordinatSystem;
    }
    return "utm33";
  }, [ifcModeller]);

  // Etasjeliste fra IFC-metadata
  const etasjer = useMemo(() => {
    for (const m of ifcModeller) {
      if (m.ifcMetadata?.etasjer && m.ifcMetadata.etasjer.length > 0) {
        return m.ifcMetadata.etasjer;
      }
    }
    return [];
  }, [ifcModeller]);

  // State
  const [valgtTegningId, setValgtTegningId] = useState<string | null>(null);
  const [synkAktiv, setSynkAktiv] = useState(true);
  const [tegningMarkør, setTegningMarkør] = useState<{ x: number; y: number } | null>(null);
  const [splitRatio, _setSplitRatio] = useState(50);
  const tegningRef = useRef<HTMLDivElement>(null);

  // Velg første tegning automatisk
  useEffect(() => {
    if (!valgtTegningId && plantegninger.length > 0) {
      setValgtTegningId(plantegninger[0]!.id);
    }
  }, [plantegninger, valgtTegningId]);

  const valgtTegning = plantegninger.find((t) => t.id === valgtTegningId);

  // Georeferanse-transformasjon for valgt tegning
  const transformasjon = useMemo(() => {
    if (!valgtTegning?.geoReference) return null;
    try {
      return beregnTransformasjon(valgtTegning.geoReference as GeoReferanse);
    } catch {
      return null;
    }
  }, [valgtTegning?.geoReference]);

  const harSynkMulighet = !!transformasjon && !!ifcOpprinnelse;

  // Klikk på tegning → fly 3D
  const håndterTegningKlikk = useCallback(
    (e: React.MouseEvent<HTMLImageElement>) => {
      if (!synkAktiv || !transformasjon || !ifcOpprinnelse) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const pxProsent = {
        x: ((e.clientX - rect.left) / rect.width) * 100,
        y: ((e.clientY - rect.top) / rect.height) * 100,
      };
      const gps = tegningTilGps(pxProsent, transformasjon);
      const punkt3d = gpsTil3D(gps, ifcOpprinnelse, coordSystem, 1.6);
      if (punkt3d) {
        viewerRef.current?.flyTil(punkt3d.x, punkt3d.y, punkt3d.z);
      }
    },
    [synkAktiv, transformasjon, ifcOpprinnelse, coordSystem, viewerRef],
  );

  // 3D-klikk → markør på tegning
  useEffect(() => {
    if (!synkAktiv || !valgtObjekt || !transformasjon || !ifcOpprinnelse) {
      setTegningMarkør(null);
      return;
    }
    const punkt = viewerRef.current?.sisteKlikkPunkt();
    if (!punkt) return;
    const gps = tredjeTilGps(punkt, ifcOpprinnelse, coordSystem);
    if (!gps) return;
    const pos = gpsTilTegning(gps, transformasjon);
    setTegningMarkør(pos);
  }, [valgtObjekt, synkAktiv, transformasjon, ifcOpprinnelse, coordSystem, viewerRef]);

  const tegningUrl = valgtTegning?.fileUrl
    ? valgtTegning.fileUrl.startsWith("/api")
      ? valgtTegning.fileUrl
      : `/api${valgtTegning.fileUrl}`
    : null;

  return (
    <div className="pointer-events-auto flex flex-1 flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2">
        {/* Tegningsvelger */}
        <select
          value={valgtTegningId ?? ""}
          onChange={(e) => setValgtTegningId(e.target.value || null)}
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        >
          <option value="">Velg tegning...</option>
          {plantegninger.map((t) => (
            <option key={t.id} value={t.id}>
              {t.drawingNumber ?? t.name} {t.floor ? `(${t.floor})` : ""}
            </option>
          ))}
        </select>

        {/* Etasjevelger */}
        {etasjer.length > 0 && (
          <select
            onChange={(e) => {
              const etasje = etasjer.find((et) => et.navn === e.target.value);
              if (!etasje) return;
              // Bytt tegning til matching etasje
              const matchendeTegning = plantegninger.find(
                (t) => t.floor === etasje.navn,
              );
              if (matchendeTegning) setValgtTegningId(matchendeTegning.id);
            }}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
            defaultValue=""
          >
            <option value="" disabled>
              Etasje...
            </option>
            {etasjer.map((e) => (
              <option key={e.navn} value={e.navn}>
                {e.navn} {e.høyde != null ? `(${e.høyde.toFixed(1)}m)` : ""}
              </option>
            ))}
          </select>
        )}

        {/* Synk-toggle */}
        <button
          onClick={() => setSynkAktiv(!synkAktiv)}
          className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium ${
            synkAktiv && harSynkMulighet
              ? "bg-blue-100 text-blue-700"
              : "bg-gray-100 text-gray-500"
          }`}
          disabled={!harSynkMulighet}
          title={
            harSynkMulighet
              ? "Synkroniser klikk mellom tegning og 3D"
              : "Krever georeferert tegning og IFC med GPS"
          }
        >
          {synkAktiv ? <Link2 size={14} /> : <Link2Off size={14} />}
          Synk
        </button>

        {!harSynkMulighet && (
          <span className="text-xs text-gray-400">
            {!transformasjon ? "Tegning mangler georeferanse" : "IFC mangler GPS"}
          </span>
        )}
      </div>

      {/* Split-view */}
      <div className="flex flex-1 overflow-hidden">
        {/* Venstre: Tegning */}
        <div
          ref={tegningRef}
          className="relative overflow-auto border-r border-gray-300 bg-gray-50"
          style={{ width: `${splitRatio}%` }}
        >
          {tegningUrl ? (
            <div className="relative inline-block min-h-full min-w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={tegningUrl}
                alt={valgtTegning?.name ?? "Tegning"}
                className="max-w-none cursor-crosshair"
                onClick={håndterTegningKlikk}
                draggable={false}
              />
              {/* Synk-markør fra 3D */}
              {tegningMarkør && (
                <div
                  className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full border-2 border-blue-500 bg-blue-500/30"
                  style={{
                    left: `${tegningMarkør.x}%`,
                    top: `${tegningMarkør.y}%`,
                  }}
                />
              )}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center text-gray-400">
                <Layers size={32} className="mx-auto mb-2" />
                <p className="text-sm">Velg en tegning</p>
              </div>
            </div>
          )}
        </div>

        {/* Høyre: 3D — ViewerCanvas rendres av layout, vises gjennom her */}
        <div
          className="pointer-events-auto relative flex-1"
          style={{ width: `${100 - splitRatio}%` }}
        >
          {/* 3D-vieweren vises via layout sin ViewerCanvas */}
          {/* Denne diven er transparent — klikk går gjennom til canvas under */}
        </div>
      </div>
    </div>
  );
}
