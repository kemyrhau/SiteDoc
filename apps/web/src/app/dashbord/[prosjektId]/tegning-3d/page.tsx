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
import { Layers, Link2, Link2Off, MapPin, Check, X, Crosshair } from "lucide-react";

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

type GeoRefSteg = "idle" | "tegning1" | "modell1" | "tegning2" | "modell2" | "ferdig";

const GEOREF_VEILEDER: Record<GeoRefSteg, string> = {
  idle: "",
  tegning1: "Steg 1/4: Dobbeltklikk på et tydelig punkt i tegningen (hjørne, søyle, kryss)",
  modell1: "Steg 2/4: Klikk på samme punkt i 3D-modellen",
  tegning2: "Steg 3/4: Dobbeltklikk på et annet punkt i tegningen (langt fra punkt 1)",
  modell2: "Steg 4/4: Klikk på samme punkt i 3D-modellen",
  ferdig: "Georeferanse satt — tegning og 3D er nå koblet!",
};

export default function Tegning3DSide() {
  const { prosjektId } = useParams<{ prosjektId: string }>();
  const { viewerRef, valgtObjekt } = useTreDViewer();
  const { aktivBygning } = useBygning();

  const tegningQuery = (trpc.tegning.hentForProsjekt as unknown as {
    useQuery: (input: { projectId: string; buildingId?: string }, opts: { enabled: boolean }) => { data: unknown };
  }).useQuery(
    { projectId: prosjektId!, ...(aktivBygning?.id ? { buildingId: aktivBygning.id } : {}) },
    { enabled: !!prosjektId },
  );
  const tegninger = (tegningQuery.data ?? []) as TegningData[];

  const plantegninger = tegninger.filter((t) => t.fileUrl && t.fileType?.toLowerCase() !== "ifc");
  const ifcModeller = tegninger.filter((t) => t.fileType?.toLowerCase() === "ifc");

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
      if (m.ifcMetadata?.etasjer && m.ifcMetadata.etasjer.length > 0) return m.ifcMetadata.etasjer;
    }
    return [];
  }, [ifcModeller]);

  // State
  const [valgtTegningId, setValgtTegningId] = useState<string | null>(null);
  const [synkAktiv, setSynkAktiv] = useState(true);
  const [tegningMarkør, setTegningMarkør] = useState<{ x: number; y: number } | null>(null);
  const [pdfZoom, setPdfZoom] = useState(100);

  // Georeferanse-modus
  const [georefSteg, setGeorefSteg] = useState<GeoRefSteg>("idle");
  const [georefPunkt1Tegning, setGeorefPunkt1Tegning] = useState<{ x: number; y: number } | null>(null);
  const [georefPunkt1Gps, setGeorefPunkt1Gps] = useState<{ lat: number; lng: number } | null>(null);
  const [georefPunkt2Tegning, setGeorefPunkt2Tegning] = useState<{ x: number; y: number } | null>(null);
  const [georefPunkt2Gps, setGeorefPunkt2Gps] = useState<{ lat: number; lng: number } | null>(null);

  const utils = trpc.useUtils();
  const settGeoRefMutation = (trpc.tegning.settGeoReferanse as unknown as {
    useMutation: (opts: { onSuccess: () => void }) => { mutate: (input: { drawingId: string; geoReference: GeoReferanse }) => void; isPending: boolean };
  }).useMutation({
    onSuccess: () => {
      utils.tegning.hentForProsjekt.invalidate();
      setGeorefSteg("ferdig");
      setTimeout(() => setGeorefSteg("idle"), 2000);
    },
  });

  function startGeoref() {
    setGeorefSteg("tegning1");
    setGeorefPunkt1Tegning(null);
    setGeorefPunkt1Gps(null);
    setGeorefPunkt2Tegning(null);
    setGeorefPunkt2Gps(null);
  }

  function avbrytGeoref() {
    setGeorefSteg("idle");
    setGeorefPunkt1Tegning(null);
    setGeorefPunkt1Gps(null);
    setGeorefPunkt2Tegning(null);
    setGeorefPunkt2Gps(null);
  }

  // Dobbeltklikk i tegning for georef-plassering
  const handleTegningDblClick = useCallback((e: React.MouseEvent) => {
    if (georefSteg !== "tegning1" && georefSteg !== "tegning2") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pxProsent = {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
    if (georefSteg === "tegning1") {
      setGeorefPunkt1Tegning(pxProsent);
      setGeorefSteg("modell1");
    } else {
      setGeorefPunkt2Tegning(pxProsent);
      setGeorefSteg("modell2");
    }
  }, [georefSteg]);

  // Split — draggbar
  const [splitPx, setSplitPx] = useState<number | null>(null);
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
    setSplitPx(Math.max(100, Math.min(rect.width - 100, e.clientX - rect.left)));
  }, []);
  const handleDragEnd = useCallback(() => { draggingRef.current = false; }, []);

  // Tegning zoom/pan
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((prev) => Math.max(0.2, Math.min(10, prev * (e.deltaY > 0 ? 0.9 : 1.1))));
  }, []);
  const handlePanStart = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    panStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [pan]);
  const handlePanMove = useCallback((e: React.PointerEvent) => {
    if (!panStartRef.current) return;
    setPan({ x: panStartRef.current.panX + e.clientX - panStartRef.current.x, y: panStartRef.current.panY + e.clientY - panStartRef.current.y });
  }, []);
  const handlePanEnd = useCallback(() => { panStartRef.current = null; }, []);

  useEffect(() => { setZoom(1); setPan({ x: 0, y: 0 }); setPdfZoom(100); }, [valgtTegningId]);
  useEffect(() => {
    if (!valgtTegningId && plantegninger.length > 0) setValgtTegningId(plantegninger[0]!.id);
  }, [plantegninger, valgtTegningId]);

  const valgtTegning = plantegninger.find((t) => t.id === valgtTegningId);
  const transformasjon = useMemo(() => {
    if (!valgtTegning?.geoReference) return null;
    try { return beregnTransformasjon(valgtTegning.geoReference as GeoReferanse); } catch { return null; }
  }, [valgtTegning?.geoReference]);
  const harSynkMulighet = !!transformasjon && !!ifcOpprinnelse;
  const erIGeorefModus = georefSteg !== "idle" && georefSteg !== "ferdig";

  // Klikk i tegning
  const clickStartRef = useRef<{ x: number; y: number } | null>(null);
  const handleImgPointerDown = useCallback((e: React.PointerEvent<HTMLImageElement>) => {
    clickStartRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleImgClick = useCallback(
    (e: React.MouseEvent<HTMLImageElement>) => {
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

      // Georef: enkeltklikk korrigerer siste punkt (etter dobbeltklikk)
      if (georefSteg === "modell1" && georefPunkt1Tegning) {
        setGeorefPunkt1Tegning(pxProsent);
        return;
      }
      if (georefSteg === "modell2" && georefPunkt2Tegning) {
        setGeorefPunkt2Tegning(pxProsent);
        return;
      }

      // Normal synk-modus
      if (!synkAktiv || !transformasjon || !ifcOpprinnelse) return;
      const gps = tegningTilGps(pxProsent, transformasjon);
      const punkt3d = gpsTil3D(gps, ifcOpprinnelse, coordSystem, 1.6);
      if (punkt3d) viewerRef.current?.flyTil(punkt3d.x, punkt3d.y, punkt3d.z);
    },
    [georefSteg, synkAktiv, transformasjon, ifcOpprinnelse, coordSystem, viewerRef],
  );

  // 3D-klikk → georef eller synk
  useEffect(() => {
    if (!valgtObjekt) return;
    const punkt = viewerRef.current?.sisteKlikkPunkt();
    if (!punkt || !ifcOpprinnelse) return;

    // Georeferanse-modus: hent GPS fra 3D-punkt
    if (georefSteg === "modell1") {
      const gps = tredjeTilGps(punkt, ifcOpprinnelse, coordSystem);
      if (gps) {
        setGeorefPunkt1Gps(gps);
        setGeorefSteg("tegning2");
      }
      return;
    }
    if (georefSteg === "modell2") {
      const gps = tredjeTilGps(punkt, ifcOpprinnelse, coordSystem);
      if (gps && georefPunkt1Tegning && georefPunkt1Gps && georefPunkt2Tegning && valgtTegningId) {
        setGeorefPunkt2Gps(gps);
        // Lagre georeferanse
        settGeoRefMutation.mutate({
          drawingId: valgtTegningId,
          geoReference: {
            point1: { pixel: georefPunkt1Tegning, gps: georefPunkt1Gps },
            point2: { pixel: georefPunkt2Tegning, gps },
          },
        });
      }
      return;
    }

    // Normal synk
    if (!synkAktiv || !transformasjon) { setTegningMarkør(null); return; }
    const gps = tredjeTilGps(punkt, ifcOpprinnelse, coordSystem);
    if (!gps) return;
    setTegningMarkør(gpsTilTegning(gps, transformasjon));
  }, [valgtObjekt]); // eslint-disable-line

  const tegningUrl = valgtTegning?.fileUrl
    ? valgtTegning.fileUrl.startsWith("/api") ? valgtTegning.fileUrl : `/api${valgtTegning.fileUrl}`
    : null;
  const erPdf = valgtTegning?.fileType?.toLowerCase() === "pdf" || tegningUrl?.toLowerCase().endsWith(".pdf");
  const splitWidth = splitPx ?? (splitContainerRef.current?.getBoundingClientRect().width ?? 800) * 0.4;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="pointer-events-auto flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2">
        <select
          value={valgtTegningId ?? ""}
          onChange={(e) => setValgtTegningId(e.target.value || null)}
          className="rounded border border-gray-300 px-2 py-1 text-sm"
          disabled={erIGeorefModus}
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
              if (etasje) { const match = plantegninger.find((t) => t.floor === etasje.navn); if (match) setValgtTegningId(match.id); }
            }}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
            defaultValue=""
            disabled={erIGeorefModus}
          >
            <option value="" disabled>Etasje...</option>
            {etasjer.map((e) => (
              <option key={e.navn} value={e.navn}>{e.navn} {e.høyde != null ? `(${e.høyde.toFixed(1)}m)` : ""}</option>
            ))}
          </select>
        )}

        {!erIGeorefModus ? (
          <>
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

            {/* DEBUG */}
            <span className="text-[10px] text-gray-400">
              IFC:{ifcModeller.length} GPS:{ifcOpprinnelse ? `${ifcOpprinnelse.lat.toFixed(2)}` : "null"}
            </span>

            {/* Georeferanse-knapp */}
            {valgtTegningId && (
              <button
                onClick={ifcOpprinnelse ? startGeoref : undefined}
                disabled={!ifcOpprinnelse}
                className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium ${
                  !ifcOpprinnelse ? "bg-gray-100 text-gray-400"
                    : transformasjon ? "bg-green-50 text-green-700" : "bg-amber-100 text-amber-700"
                }`}
                title={
                  !ifcOpprinnelse ? `IFC mangler GPS (${ifcModeller.length} IFC-filer funnet)`
                    : transformasjon ? "Tegningen er georeferert — klikk for å sette på nytt"
                    : "Georeferér tegningen mot 3D-modellen"
                }
              >
                <MapPin size={14} />
                {!ifcOpprinnelse ? "Mangler GPS" : transformasjon ? "Georeferert" : "Georeferér"}
              </button>
            )}
          </>
        ) : (
          <button
            onClick={avbrytGeoref}
            className="flex items-center gap-1.5 rounded bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700"
          >
            <X size={14} />
            Avbryt georeferanse
          </button>
        )}

        {/* Zoom-kontroller for PDF */}
        {erPdf && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPdfZoom((p) => Math.max(25, p - 25))}
              className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600 hover:bg-gray-200"
            >−</button>
            <span className="text-xs text-gray-500 w-10 text-center">{pdfZoom}%</span>
            <button
              onClick={() => setPdfZoom((p) => Math.min(400, p + 25))}
              className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600 hover:bg-gray-200"
            >+</button>
          </div>
        )}

        {/* Zoom-kontroller for bilde */}
        {!erPdf && zoom !== 1 && (
          <button
            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
            className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600"
          >
            {Math.round(zoom * 100)}% — Tilbakestill
          </button>
        )}
      </div>

      {/* Georeferanse-veileder */}
      {georefSteg !== "idle" && (
        <div className={`pointer-events-auto flex items-center gap-3 px-4 py-2 text-sm ${
          georefSteg === "ferdig" ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"
        }`}>
          <Crosshair size={16} />
          <span className="font-medium">{GEOREF_VEILEDER[georefSteg]}</span>
          {georefPunkt1Tegning && (
            <span className="flex items-center gap-1 rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
              1: {georefPunkt1Tegning.x.toFixed(0)}%, {georefPunkt1Tegning.y.toFixed(0)}%
              {georefPunkt1Gps && <Check size={10} />}
            </span>
          )}
          {georefPunkt2Tegning && (
            <span className="flex items-center gap-1 rounded bg-green-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
              2: {georefPunkt2Tegning.x.toFixed(0)}%, {georefPunkt2Tegning.y.toFixed(0)}%
              {georefPunkt2Gps && <Check size={10} />}
            </span>
          )}
          {(georefSteg === "modell1" || georefSteg === "modell2") && (
            <span className="text-xs text-amber-600">Dobbeltklikk i tegningen for å korrigere punktet</span>
          )}
          {georefSteg === "ferdig" && <Check size={16} className="text-green-600" />}
        </div>
      )}

      {/* Split-view */}
      <div
        ref={splitContainerRef}
        className="flex flex-1 overflow-hidden"
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
      >
        {/* Venstre: Tegning */}
        <div
          className="pointer-events-auto relative overflow-hidden bg-gray-100"
          style={{ width: splitWidth, flexShrink: 0 }}
        >
          {tegningUrl ? (
            erPdf ? (
              /* PDF — iframe, dobbeltklikk for georef */
              <div className="relative h-full w-full">
                <iframe
                  key={`${tegningUrl}-${pdfZoom}`}
                  src={`${tegningUrl}#zoom=${pdfZoom}`}
                  title={valgtTegning?.name ?? "Tegning"}
                  className="h-full w-full border-0"
                />
                {/* Georef overlay — fanger dobbeltklikk, lar scroll passere */}
                {erIGeorefModus && (georefSteg === "tegning1" || georefSteg === "tegning2") && (
                  <div
                    className="absolute inset-0"
                    style={{ cursor: "crosshair" }}
                    onDoubleClick={handleTegningDblClick}
                    onWheel={(e) => {
                      // La scroll passere til PDF via zoom-knapper
                      e.preventDefault();
                      setPdfZoom((p) => Math.max(25, Math.min(400, p + (e.deltaY > 0 ? -25 : 25))));
                    }}
                  />
                )}
                {/* Merk: Markører over PDF vises i veilederen (koordinater), ikke visuelt — de drifter ved scroll */}
              </div>
            ) : (
              /* Bilde (SVG/PNG) — med zoom/pan */
              <div
                className="relative h-full w-full"
                onWheel={handleWheel}
                onPointerDown={handlePanStart}
                onPointerMove={handlePanMove}
                onPointerUp={handlePanEnd}
              >
                <div
                  className="relative origin-top-left"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    cursor: erIGeorefModus ? "crosshair" : panStartRef.current ? "grabbing" : "default",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={tegningUrl}
                    alt={valgtTegning?.name ?? "Tegning"}
                    className="max-w-none select-none"
                    onPointerDown={handleImgPointerDown}
                    onClick={handleImgClick}
                    onDoubleClick={(e) => {
                      if (georefSteg !== "tegning1" && georefSteg !== "tegning2") return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const pxProsent = {
                        x: ((e.clientX - rect.left) / rect.width) * 100,
                        y: ((e.clientY - rect.top) / rect.height) * 100,
                      };
                      if (georefSteg === "tegning1") { setGeorefPunkt1Tegning(pxProsent); setGeorefSteg("modell1"); }
                      else { setGeorefPunkt2Tegning(pxProsent); setGeorefSteg("modell2"); }
                    }}
                    draggable={false}
                  />
                  {tegningMarkør && !erIGeorefModus && (
                    <>
                      <div className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500" style={{ left: `${tegningMarkør.x}%`, top: `${tegningMarkør.y}%` }} />
                      <div className="pointer-events-none absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full border-2 border-blue-500" style={{ left: `${tegningMarkør.x}%`, top: `${tegningMarkør.y}%` }} />
                    </>
                  )}
                  {georefPunkt1Tegning && (
                    <div className="pointer-events-none absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow" style={{ left: `${georefPunkt1Tegning.x}%`, top: `${georefPunkt1Tegning.y}%` }}>1</div>
                  )}
                  {georefPunkt2Tegning && (
                    <div className="pointer-events-none absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-green-500 text-[10px] font-bold text-white shadow" style={{ left: `${georefPunkt2Tegning.x}%`, top: `${georefPunkt2Tegning.y}%` }}>2</div>
                  )}
                </div>
              </div>
            )
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center text-gray-400">
                <Layers size={32} className="mx-auto mb-2" />
                <p className="text-sm">Velg en tegning</p>
              </div>
            </div>
          )}
        </div>

        {/* Skillelinje */}
        <div
          className="pointer-events-auto group relative z-20 flex w-1.5 cursor-col-resize items-center justify-center bg-gray-300 hover:bg-blue-400 active:bg-blue-500"
          onPointerDown={handleDragStart}
        >
          <div className="h-8 w-1 rounded-full bg-gray-500 group-hover:bg-white" />
        </div>

        {/* Høyre: 3D */}
        <div className="relative flex-1">
          {/* Georef 3D-veileder overlay */}
          {(georefSteg === "modell1" || georefSteg === "modell2") && (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-amber-500/90 px-4 py-2 text-center text-sm font-medium text-white">
              Klikk på punkt {georefSteg === "modell1" ? "1" : "2"} i 3D-modellen
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
