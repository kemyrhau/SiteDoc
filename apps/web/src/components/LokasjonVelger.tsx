"use client";

import { useState, useRef, useCallback } from "react";
import { Modal, Button } from "@sitedoc/ui";
import { trpc } from "@/lib/trpc";
import { MapPin, X } from "lucide-react";

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
    buildingId?: string | null;
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
  const [open, setOpen] = useState(false);
  const [valgtBygningId, setValgtBygningId] = useState<string>("");
  const [valgtTegningId, setValgtTegningId] = useState<string>("");
  const [punkt, setPunkt] = useState<{ x: number; y: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

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
    floor: string | null; buildingId: string | null;
    fileUrl: string | null; fileType: string | null;
  }>).filter((t) => !valgtBygningId || t.buildingId === valgtBygningId);

  const { data: valgtTegningData } = trpc.tegning.hentMedId.useQuery(
    { id: valgtTegningId },
    { enabled: !!valgtTegningId },
  );

  const tegningUrl = valgtTegningData
    ? `/api${(valgtTegningData as { fileUrl?: string }).fileUrl ?? ""}`
    : null;

  function åpne() {
    setValgtBygningId("");
    setValgtTegningId(tegningId ?? "");
    setPunkt(positionX != null && positionY != null ? { x: positionX, y: positionY } : null);
    setOpen(true);
  }

  const handleImgKlikk = useCallback(
    (e: React.MouseEvent<HTMLImageElement>) => {
      if (!visPosisjon || !imgRef.current) return;
      const rect = imgRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setPunkt({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
    },
    [visPosisjon],
  );

  function handleLagre() {
    const tegning = tegninger.find((t) => t.id === valgtTegningId);
    onLagre({
      drawingId: valgtTegningId || null,
      buildingId: tegning?.buildingId ?? null,
      positionX: visPosisjon ? (punkt?.x ?? null) : undefined,
      positionY: visPosisjon ? (punkt?.y ?? null) : undefined,
    });
    setOpen(false);
  }

  function handleFjern() {
    onLagre({ drawingId: null, buildingId: null, positionX: null, positionY: null });
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

          {/* Tegningsvisning med klikk-plassering */}
          {tegningUrl && (
            <div className="relative overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
              <img
                ref={imgRef}
                src={tegningUrl}
                alt="Tegning"
                className={`w-full ${visPosisjon ? "cursor-crosshair" : ""}`}
                onClick={handleImgKlikk}
              />
              {punkt && visPosisjon && (
                <div
                  className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-red-500 shadow"
                  style={{ left: `${punkt.x}%`, top: `${punkt.y}%` }}
                />
              )}
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
