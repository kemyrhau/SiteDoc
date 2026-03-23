"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { useTreDViewer } from "@/kontekst/tred-viewer-kontekst";
import { useBygning } from "@/kontekst/bygning-kontekst";
import {
  beregnTransformasjon,
  tegningTilGps,
  gpsTilTegning,
  gpsTil3D,
  tredjeTilGps,
} from "@sitedoc/shared/utils";
import type { GeoReferanse } from "@sitedoc/shared";
import type { KoordinatSystem } from "@sitedoc/shared/utils";
import { Layers, Link2, Link2Off } from "lucide-react";

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
  const { aktivBygning } = useBygning();

  // Cast for å unngå TS2589 (excessively deep type instantiation)
  const tegningQuery = (trpc.tegning.hentForProsjekt as unknown as {
    useQuery: (input: { projectId: string; buildingId?: string }, opts: { enabled: boolean }) => { data: unknown };
  }).useQuery(
    { projectId: prosjektId!, ...(aktivBygning?.id ? { buildingId: aktivBygning.id } : {}) },
    { enabled: !!prosjektId },
  );
  const tegninger = (tegningQuery.data ?? []) as TegningData[];

  const plantegninger = tegninger.filter(
    (t) => t.fileUrl && t.fileType?.toLowerCase() !== "ifc",
  );
  const ifcModeller = tegninger.filter(
    (t) => t.fileType?.toLowerCase() === "ifc",
  );

  const ifcOpprinnelse = useMemo(() => {
    for (const m of ifcModeller) {
      if (m.ifcMetadata?.gpsBreddegrad && m.ifcMetadata?.gpsLengdegrad) {
        return { lat: m.ifcMetadata.gpsBreddegrad, lng: m.ifcMetadata.gpsLengdegrad };
      }
    }
    return null;
  }, [ifcModeller]);

  const coordSystem: KoordinatSystem = useMemo(() => {
    for (const m of ifcModeller) {
      if (m.coordinateSystem) return m.coordinateSystem as KoordinatSystem;
    }
    return "utm33";
  }, [ifcModeller]);

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

  // Split — draggbar
  const [splitPx, setSplitPx] = useState<number | null>(null); // null = 40% default
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const handleDragStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handleDragMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current || !splitContainerRef.current) return;
    const rect = splitContainerRef.current.getBoundingClientRect();
    const x = Math.max(100, Math.min(rect.width - 100, e.clientX - rect.left));
    setSplitPx(x);
  }, []);

  const handleDragEnd = useCallback(() => {
    draggingRef.current = false;
  }, []);

  // Tegning zoom/pan
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const tegningContainerRef = useRef<HTMLDivElement>(null);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((prev) => Math.max(0.2, Math.min(10, prev * delta)));
  }, []);

  const handlePanStart = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    panStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [pan]);

  const handlePanMove = useCallback((e: React.PointerEvent) => {
    if (!panStartRef.current) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setPan({ x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy });
  }, []);

  const handlePanEnd = useCallback(() => {
    panStartRef.current = null;
  }, []);

  // Reset zoom ved tegningbytte
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [valgtTegningId]);

  // Velg første tegning automatisk
  useEffect(() => {
    if (!valgtTegningId && plantegninger.length > 0) {
      setValgtTegningId(plantegninger[0]!.id);
    }
  }, [plantegninger, valgtTegningId]);

  const valgtTegning = plantegninger.find((t) => t.id === valgtTegningId);

  const transformasjon = useMemo(() => {
    if (!valgtTegning?.geoReference) return null;
    try {
      return beregnTransformasjon(valgtTegning.geoReference as GeoReferanse);
    } catch {
      return null;
    }
  }, [valgtTegning?.geoReference]);

  const harSynkMulighet = !!transformasjon && !!ifcOpprinnelse;

  // Klikk på tegning → fly 3D (skiller klikk fra pan med avstandsterskel)
  const clickStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleImgPointerDown = useCallback((e: React.PointerEvent<HTMLImageElement>) => {
    clickStartRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleImgClick = useCallback(
    (e: React.MouseEvent<HTMLImageElement>) => {
      if (!synkAktiv || !transformasjon || !ifcOpprinnelse) return;
      // Ignorer klikk etter pan
      if (clickStartRef.current) {
        const dx = e.clientX - clickStartRef.current.x;
        const dy = e.clientY - clickStartRef.current.y;
        if (Math.sqrt(dx * dx + dy * dy) > 5) return;
      }
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

  const splitWidth = splitPx ?? (splitContainerRef.current?.getBoundingClientRect().width ?? 800) * 0.4;

  return (
    <div className="pointer-events-auto flex flex-1 flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2">
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

        {etasjer.length > 0 && (
          <select
            onChange={(e) => {
              const etasje = etasjer.find((et) => et.navn === e.target.value);
              if (!etasje) return;
              const match = plantegninger.find((t) => t.floor === etasje.navn);
              if (match) setValgtTegningId(match.id);
            }}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
            defaultValue=""
          >
            <option value="" disabled>Etasje...</option>
            {etasjer.map((e) => (
              <option key={e.navn} value={e.navn}>
                {e.navn} {e.høyde != null ? `(${e.høyde.toFixed(1)}m)` : ""}
              </option>
            ))}
          </select>
        )}

        <button
          onClick={() => setSynkAktiv(!synkAktiv)}
          className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium ${
            synkAktiv && harSynkMulighet ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
          }`}
          disabled={!harSynkMulighet}
          title={harSynkMulighet ? "Synkroniser klikk mellom tegning og 3D" : "Krever georeferert tegning og IFC med GPS"}
        >
          {synkAktiv ? <Link2 size={14} /> : <Link2Off size={14} />}
          Synk
        </button>

        {zoom !== 1 && (
          <button
            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
            className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600"
          >
            {Math.round(zoom * 100)}% — Tilbakestill
          </button>
        )}

        {!harSynkMulighet && (
          <span className="text-xs text-gray-400">
            {!transformasjon ? "Tegning mangler georeferanse" : "IFC mangler GPS"}
          </span>
        )}
      </div>

      {/* Split-view med draggbar skillelinje */}
      <div
        ref={splitContainerRef}
        className="flex flex-1 overflow-hidden"
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
      >
        {/* Venstre: Tegning med zoom/pan */}
        <div
          className="relative overflow-hidden bg-gray-100"
          style={{ width: splitWidth, flexShrink: 0 }}
          onWheel={handleWheel}
          onPointerDown={handlePanStart}
          onPointerMove={handlePanMove}
          onPointerUp={handlePanEnd}
        >
          {tegningUrl ? (
            <div
              className="relative origin-top-left"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                cursor: panStartRef.current ? "grabbing" : "crosshair",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={tegningUrl}
                alt={valgtTegning?.name ?? "Tegning"}
                className="max-w-none select-none"
                onPointerDown={handleImgPointerDown}
                onClick={handleImgClick}
                draggable={false}
              />
              {/* Synk-markør fra 3D */}
              {tegningMarkør && (
                <>
                  <div
                    className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500"
                    style={{ left: `${tegningMarkør.x}%`, top: `${tegningMarkør.y}%` }}
                  />
                  <div
                    className="pointer-events-none absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full border-2 border-blue-500"
                    style={{ left: `${tegningMarkør.x}%`, top: `${tegningMarkør.y}%` }}
                  />
                </>
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

        {/* Draggbar skillelinje */}
        <div
          className="group relative z-20 flex w-1.5 cursor-col-resize items-center justify-center bg-gray-300 hover:bg-blue-400 active:bg-blue-500"
          onPointerDown={handleDragStart}
        >
          <div className="h-8 w-1 rounded-full bg-gray-500 group-hover:bg-white" />
        </div>

        {/* Høyre: 3D — ViewerCanvas rendres av layout */}
        <div className="pointer-events-auto relative flex-1" />
      </div>
    </div>
  );
}
