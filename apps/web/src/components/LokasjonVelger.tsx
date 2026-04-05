"use client";

import { useState, useRef, useCallback } from "react";
import { Modal, Button } from "@sitedoc/ui";
import { trpc } from "@/lib/trpc";
import { useByggeplass } from "@/kontekst/byggeplass-kontekst";
import { MapPin, X, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface LokasjonVelgerProps {
  prosjektId: string;
  tegningId?: string | null;
  tegningNavn?: string | null;
  bygningNavn?: string | null;
  positionX?: number | null;
  positionY?: number | null;
  visPosisjon?: boolean;
  onLagre: (data: {
    drawingId: string | null;
    byggeplassId?: string | null;
    positionX?: number | null;
    positionY?: number | null;
  }) => void;
  leseModus?: boolean;
}

export function LokasjonVelger({
  prosjektId,
  tegningId,
  tegningNavn,
  bygningNavn,
  positionX,
  positionY,
  visPosisjon,
  onLagre,
  leseModus,
}: LokasjonVelgerProps) {
  const { aktivByggeplass, standardTegning } = useByggeplass();
  const [open, setOpen] = useState(false);
  const [valgtBygningId, setValgtBygningId] = useState<string>("");
  const [valgtTegningId, setValgtTegningId] = useState<string>("");
  const [punkt, setPunkt] = useState<{ x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: bygninger } = trpc.bygning.hentForProsjekt.useQuery(
    { projectId: prosjektId },
    { enabled: open },
  );

  const { data: tegningerRå } = trpc.tegning.hentForProsjekt.useQuery(
    { projectId: prosjektId },
    { enabled: open },
  );

  const tegninger = ((tegningerRå ?? []) as Array<{
    id: string; name: string; drawingNumber: string | null;
    floor: string | null; byggeplassId: string | null;
    fileUrl: string | null; fileType: string | null;
  }>).filter((t) => !valgtBygningId || t.byggeplassId === valgtBygningId);

  const { data: valgtTegningData } = trpc.tegning.hentMedId.useQuery(
    { id: valgtTegningId },
    { enabled: !!valgtTegningId },
  );

  const tegningUrl = valgtTegningData
    ? `/api${(valgtTegningData as { fileUrl?: string }).fileUrl ?? ""}`
    : null;

  function åpne() {
    // Bruk eksisterende verdier, eller fall tilbake til aktiv bygning/tegning fra kontekst
    setValgtBygningId(aktivByggeplass?.id ?? "");
    setValgtTegningId(tegningId ?? standardTegning?.id ?? "");
    setPunkt(positionX != null && positionY != null ? { x: positionX, y: positionY } : null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setOpen(true);
  }

  const handleImgKlikk = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!visPosisjon || !imgRef.current || isPanning) return;
      const rect = imgRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setPunkt({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
    },
    [visPosisjon, isPanning],
  );

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((prev) => Math.max(1, Math.min(10, prev * (e.deltaY < 0 ? 1.15 : 0.87))));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    // Kun pan når zoomet inn
    if (zoom <= 1) return;
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }, [zoom, pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({
      x: panStart.current.panX + (e.clientX - panStart.current.x),
      y: panStart.current.panY + (e.clientY - panStart.current.y),
    });
  }, [isPanning]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  function handleLagre() {
    const tegning = tegninger.find((t) => t.id === valgtTegningId);
    onLagre({
      drawingId: valgtTegningId || null,
      byggeplassId: tegning?.byggeplassId ?? null,
      positionX: visPosisjon ? (punkt?.x ?? null) : undefined,
      positionY: visPosisjon ? (punkt?.y ?? null) : undefined,
    });
    setOpen(false);
  }

  function handleFjern() {
    onLagre({ drawingId: null, byggeplassId: null, positionX: null, positionY: null });
    setOpen(false);
  }

  const harLokasjon = !!tegningId;
  const visTekst = harLokasjon
    ? `${bygningNavn ? bygningNavn + " · " : ""}${tegningNavn ?? "Tegning"}`
    : "Ikke satt — klikk for å velge";

  return (
    <>
      <div
        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
          leseModus ? "border-gray-100 bg-gray-50" : "cursor-pointer border-gray-200 hover:bg-gray-50"
        }`}
        onClick={leseModus ? undefined : åpne}
      >
        <MapPin className={`h-4 w-4 shrink-0 ${harLokasjon ? "text-blue-500" : "text-gray-300"}`} />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Lokasjon</div>
          <div className={`truncate ${harLokasjon ? "text-gray-800" : "text-gray-400 italic"}`}>
            {visTekst}
          </div>
        </div>
        {harLokasjon && !leseModus && (
          <button
            onClick={(e) => { e.stopPropagation(); handleFjern(); }}
            className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
            title="Fjern lokasjon"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Velg lokasjon">
        <div className="flex flex-col gap-3">
          {/* Bygning */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Bygning</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={valgtBygningId}
              onChange={(e) => { setValgtBygningId(e.target.value); setValgtTegningId(""); setPunkt(null); }}
            >
              <option value="">Alle bygninger</option>
              {(bygninger ?? []).map((b: { id: string; name: string; number: number | null }) => (
                <option key={b.id} value={b.id}>
                  {b.number ? `${b.number}. ${b.name}` : b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Tegning */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Tegning</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={valgtTegningId}
              onChange={(e) => { setValgtTegningId(e.target.value); setPunkt(null); }}
            >
              <option value="">Velg tegning...</option>
              {tegninger.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.drawingNumber ? `${t.drawingNumber} — ` : ""}{t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Tegningsvisning med zoom/pan og klikk-plassering */}
          {tegningUrl && (
            <div>
              <div
                ref={containerRef}
                className="relative overflow-hidden rounded-lg border border-gray-200 bg-gray-100"
                style={{ maxHeight: 400, cursor: zoom > 1 ? (isPanning ? "grabbing" : "grab") : (visPosisjon ? "crosshair" : "default") }}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onClick={handleImgKlikk}
              >
                <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "center center", transition: isPanning ? "none" : "transform 0.1s" }}>
                  <img
                    ref={imgRef}
                    src={tegningUrl}
                    alt="Tegning"
                    className="w-full"
                    draggable={false}
                  />
                  {punkt && visPosisjon && (
                    <div
                      className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-red-500 shadow"
                      style={{ left: `${punkt.x}%`, top: `${punkt.y}%` }}
                    />
                  )}
                </div>
              </div>
              <div className="mt-1.5 flex items-center gap-1">
                <button type="button" onClick={() => setZoom((z) => Math.min(10, z * 1.3))} className="rounded p-1 text-gray-400 hover:bg-gray-100"><ZoomIn className="h-4 w-4" /></button>
                <button type="button" onClick={() => setZoom((z) => Math.max(1, z / 1.3))} className="rounded p-1 text-gray-400 hover:bg-gray-100"><ZoomOut className="h-4 w-4" /></button>
                <button type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="rounded p-1 text-gray-400 hover:bg-gray-100"><RotateCcw className="h-4 w-4" /></button>
                <span className="ml-1 text-[10px] text-gray-400">{Math.round(zoom * 100)}%</span>
                {visPosisjon && <span className="ml-auto text-[10px] text-gray-400">Scroll for å zoome · Klikk for å plassere punkt</span>}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button onClick={handleLagre} disabled={!valgtTegningId}>
              Lagre
            </Button>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Avbryt
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
