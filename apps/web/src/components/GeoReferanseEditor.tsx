"use client";

import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button, Input } from "@siteflow/ui";
import {
  MapPin,
  Trash2,
  Check,
  ExternalLink,
  Hand,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Crosshair,
} from "lucide-react";
import type { GeoReferanse } from "@siteflow/shared";

interface TegningInfo {
  id: string;
  name: string;
  fileUrl: string;
  fileType: string;
  geoReference?: unknown;
}

interface GeoReferanseEditorProps {
  tegningId: string;
  tegning: TegningInfo | null;
  onLagret: () => void;
}

interface Punkt {
  pixel: { x: number; y: number };
  gps: { lat: string; lng: string };
}

/** Konverterer UTM sone 33N (EUREF89) til WGS84 lat/lng */
function utm33TilLatLng(nord: number, ost: number): { lat: number; lng: number } {
  // WGS84-ellipsoiden
  const a = 6378137.0; // stor halvakse
  const f = 1 / 298.257223563; // flattrykking
  const e2 = 2 * f - f * f; // eksentrisitet²
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const k0 = 0.9996; // skalafaktor
  const lng0 = 15 * Math.PI / 180; // sentralmeridian sone 33

  const M = nord / k0;
  const mu = M / (a * (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 * e2 * e2 / 256));

  const phi1 =
    mu +
    (3 * e1 / 2 - 27 * e1 * e1 * e1 / 32) * Math.sin(2 * mu) +
    (21 * e1 * e1 / 16 - 55 * e1 * e1 * e1 * e1 / 32) * Math.sin(4 * mu) +
    (151 * e1 * e1 * e1 / 96) * Math.sin(6 * mu) +
    (1097 * e1 * e1 * e1 * e1 / 512) * Math.sin(8 * mu);

  const ep2 = e2 / (1 - e2);
  const sinPhi1 = Math.sin(phi1);
  const cosPhi1 = Math.cos(phi1);
  const tanPhi1 = Math.tan(phi1);
  const N1 = a / Math.sqrt(1 - e2 * sinPhi1 * sinPhi1);
  const T1 = tanPhi1 * tanPhi1;
  const C1 = ep2 * cosPhi1 * cosPhi1;
  const R1 = a * (1 - e2) / Math.pow(1 - e2 * sinPhi1 * sinPhi1, 1.5);
  const D = (ost - 500000) / (N1 * k0);

  const lat =
    phi1 -
    (N1 * tanPhi1 / R1) *
      (D * D / 2 -
        (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * D * D * D * D / 24 +
        (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) *
          D * D * D * D * D * D / 720);

  const lng =
    lng0 +
    (D -
      (1 + 2 * T1 + C1) * D * D * D / 6 +
      (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) *
        D * D * D * D * D / 120) /
      cosPhi1;

  return {
    lat: (lat * 180) / Math.PI,
    lng: (lng * 180) / Math.PI,
  };
}

/**
 * Parser koordinater fra ulike formater:
 * - DMS: 69°38'39.9"N 18°55'24.2"E
 * - Desimal: 69.644, 18.923
 * - UTM33 (Norgeskart): Nord 7731109.65 Øst 652332.37
 */
function parserKoordinater(tekst: string): { lat: string; lng: string } | null {
  const trimmet = tekst.trim();

  // UTM33-format fra Norgeskart: "Nord 7731109.65 Øst 652332.37" eller bare tallene
  // Prøv med labels først
  const utmLabelMatch = trimmet.match(
    /[Nn]ord\s+(\d{6,8}[.,]?\d*)\s*[ØøOo]st\s+(\d{5,7}[.,]?\d*)/
  );
  if (utmLabelMatch?.[1] && utmLabelMatch[2]) {
    const nord = Number(utmLabelMatch[1].replace(",", "."));
    const ost = Number(utmLabelMatch[2].replace(",", "."));
    if (nord > 6000000 && nord < 8500000 && ost > 100000 && ost < 900000) {
      const resultat = utm33TilLatLng(nord, ost);
      return { lat: resultat.lat.toFixed(6), lng: resultat.lng.toFixed(6) };
    }
  }

  // UTM33 uten labels: to tall der første er 7-sifret (northing) og andre er 6-sifret (easting)
  const utmTallMatch = trimmet.match(
    /^(\d{6,8}[.,]?\d*)[,\s]+(\d{5,7}[.,]?\d*)$/
  );
  if (utmTallMatch?.[1] && utmTallMatch[2]) {
    const a = Number(utmTallMatch[1].replace(",", "."));
    const b = Number(utmTallMatch[2].replace(",", "."));
    if (a > 6000000 && a < 8500000 && b > 100000 && b < 900000) {
      const resultat = utm33TilLatLng(a, b);
      return { lat: resultat.lat.toFixed(6), lng: resultat.lng.toFixed(6) };
    }
  }

  // Desimalformat: "69.644, 18.923" eller "69.644 18.923"
  const desimalMatch = trimmet.match(/^(-?\d+[.,]\d+)[,\s]+(-?\d+[.,]\d+)$/);
  if (desimalMatch?.[1] && desimalMatch[2]) {
    return {
      lat: desimalMatch[1].replace(",", "."),
      lng: desimalMatch[2].replace(",", "."),
    };
  }

  // DMS-format: 69°38'39.9"N 18°55'24.2"E
  const dmsRegex = /(\d+)[°](\d+)[′'](\d+[.,]?\d*)[″"]\s*([NSns])\s*[,\s]*(\d+)[°](\d+)[′'](\d+[.,]?\d*)[″"]\s*([EWew])/;
  const dmsMatch = trimmet.match(dmsRegex);
  if (dmsMatch?.[1] && dmsMatch[2] && dmsMatch[3] && dmsMatch[4] && dmsMatch[5] && dmsMatch[6] && dmsMatch[7] && dmsMatch[8]) {
    const latGrader = Number(dmsMatch[1]);
    const latMin = Number(dmsMatch[2]);
    const latSek = Number(dmsMatch[3].replace(",", "."));
    const latRetning = dmsMatch[4].toUpperCase();
    const lngGrader = Number(dmsMatch[5]);
    const lngMin = Number(dmsMatch[6]);
    const lngSek = Number(dmsMatch[7].replace(",", "."));
    const lngRetning = dmsMatch[8].toUpperCase();

    let lat = latGrader + latMin / 60 + latSek / 3600;
    let lng = lngGrader + lngMin / 60 + lngSek / 3600;
    if (latRetning === "S") lat = -lat;
    if (lngRetning === "W") lng = -lng;

    return {
      lat: lat.toFixed(6),
      lng: lng.toFixed(6),
    };
  }

  return null;
}

export function GeoReferanseEditor({
  tegningId,
  tegning,
  onLagret,
}: GeoReferanseEditorProps) {
  const utils = trpc.useUtils();
  const bildeRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Zoom og panorering
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [erDraging, setErDraging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [modus, setModus] = useState<"peker" | "hånd">("peker");

  // Eksisterende georeferanse
  const eksisterende = tegning?.geoReference as GeoReferanse | null | undefined;

  // Kalibrering-state
  const [punkt1, setPunkt1] = useState<Punkt | null>(
    eksisterende?.point1
      ? {
          pixel: eksisterende.point1.pixel,
          gps: {
            lat: String(eksisterende.point1.gps.lat),
            lng: String(eksisterende.point1.gps.lng),
          },
        }
      : null,
  );
  const [punkt2, setPunkt2] = useState<Punkt | null>(
    eksisterende?.point2
      ? {
          pixel: eksisterende.point2.pixel,
          gps: {
            lat: String(eksisterende.point2.gps.lat),
            lng: String(eksisterende.point2.gps.lng),
          },
        }
      : null,
  );
  const [aktivtPunkt, setAktivtPunkt] = useState<1 | 2 | null>(null);

  const settGeoMutasjon = trpc.tegning.settGeoReferanse.useMutation({
    onSuccess: () => {
      utils.bygning.hentMedId.invalidate();
      utils.tegning.hentMedId.invalidate({ id: tegningId });
      onLagret();
    },
  });

  const fjernGeoMutasjon = trpc.tegning.fjernGeoReferanse.useMutation({
    onSuccess: () => {
      setPunkt1(null);
      setPunkt2(null);
      setAktivtPunkt(null);
      utils.bygning.hentMedId.invalidate();
      utils.tegning.hentMedId.invalidate({ id: tegningId });
      onLagret();
    },
  });

  const handleBildeKlikk = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (modus === "hånd") return;
      if (!aktivtPunkt) return;
      if (erDraging) return;
      const container = containerRef.current;
      const bilde = bildeRef.current;
      if (!container || !bilde) return;

      // Konverter skjermkoordinater til lokale koordinater
      // ved å invertere CSS-transform: translate(pan) scale(zoom) med origin center
      const containerRect = container.getBoundingClientRect();
      const bildeBredd = bilde.offsetWidth;
      const bildeHoyde = bilde.offsetHeight;
      const ox = bildeBredd / 2;
      const oy = bildeHoyde / 2;

      const klikkX = e.clientX - containerRect.left;
      const klikkY = e.clientY - containerRect.top;
      const lokalX = (klikkX - pan.x - ox) / zoom + ox;
      const lokalY = (klikkY - pan.y - oy) / zoom + oy;

      const x = Math.max(0, Math.min(100, (lokalX / bildeBredd) * 100));
      const y = Math.max(0, Math.min(100, (lokalY / bildeHoyde) * 100));

      const pixel = { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };

      if (aktivtPunkt === 1) {
        setPunkt1((prev) => ({ pixel, gps: prev?.gps ?? { lat: "", lng: "" } }));
        setAktivtPunkt(null);
      } else {
        setPunkt2((prev) => ({ pixel, gps: prev?.gps ?? { lat: "", lng: "" } }));
        setAktivtPunkt(null);
      }
    },
    [aktivtPunkt, modus, erDraging, zoom, pan],
  );

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width;
    const my = (e.clientY - rect.top) / rect.height;

    setZoom((prev) => {
      const faktor = e.deltaY > 0 ? 0.9 : 1.1;
      const neste = Math.min(10, Math.max(1, prev * faktor));
      const skalaDiff = neste - prev;

      setPan((p) => ({
        x: p.x - skalaDiff * (mx - 0.5) * rect.width,
        y: p.y - skalaDiff * (my - 0.5) * rect.height,
      }));

      return neste;
    });
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (modus !== "hånd" && !aktivtPunkt) return;
      if (modus === "hånd") {
        e.preventDefault();
        setErDraging(true);
        dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      }
    },
    [modus, pan, aktivtPunkt],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!erDraging) return;
      setPan({
        x: dragStart.current.panX + (e.clientX - dragStart.current.x),
        y: dragStart.current.panY + (e.clientY - dragStart.current.y),
      });
    },
    [erDraging],
  );

  const handleMouseUp = useCallback(() => {
    setErDraging(false);
  }, []);

  const nullstillVisning = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const zoomInn = useCallback(() => {
    setZoom((prev) => Math.min(10, prev * 1.3));
  }, []);

  const zoomUt = useCallback(() => {
    setZoom((prev) => Math.max(1, prev / 1.3));
  }, []);

  const kanLagre =
    punkt1 &&
    punkt2 &&
    punkt1.gps.lat &&
    punkt1.gps.lng &&
    punkt2.gps.lat &&
    punkt2.gps.lng &&
    !isNaN(Number(punkt1.gps.lat)) &&
    !isNaN(Number(punkt1.gps.lng)) &&
    !isNaN(Number(punkt2.gps.lat)) &&
    !isNaN(Number(punkt2.gps.lng));

  function handleLagre() {
    if (!punkt1 || !punkt2) return;

    settGeoMutasjon.mutate({
      drawingId: tegningId,
      geoReference: {
        point1: {
          pixel: punkt1.pixel,
          gps: { lat: Number(punkt1.gps.lat), lng: Number(punkt1.gps.lng) },
        },
        point2: {
          pixel: punkt2.pixel,
          gps: { lat: Number(punkt2.gps.lat), lng: Number(punkt2.gps.lng) },
        },
      },
    });
  }

  if (!tegning) {
    return (
      <div className="text-center text-gray-400">
        Velg en tegning for å kalibrere georeferanse
      </div>
    );
  }

  const erBilde = ["png", "jpg", "jpeg"].includes(tegning.fileType ?? "");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="mb-1 text-lg font-semibold text-gray-900">
          Georeferanse-kalibrering
        </h3>
        <p className="text-sm text-gray-500">
          Klikk to punkter på tegningen og oppgi GPS-koordinater for hvert punkt.
          Dette lar mobilappen beregne posisjon automatisk fra GPS.
        </p>
        <a
          href="https://norgeskart.no"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Åpne Norgeskart for koordinater
        </a>
      </div>

      {/* Tegning med klikkbare punkter */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-gray-700">{tegning.name}</p>
              {aktivtPunkt && (
                <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                  Klikk på tegningen for å plassere punkt {aktivtPunkt}
                </span>
              )}
            </div>

            {/* Verktøylinje for zoom/pan */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setModus(modus === "peker" ? "hånd" : "peker")}
                className={`rounded p-1.5 transition-colors ${
                  modus === "hånd"
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-500 hover:bg-gray-200"
                }`}
                title={modus === "hånd" ? "Bytt til peker" : "Bytt til hånd (panorer)"}
              >
                {modus === "hånd" ? (
                  <Hand className="h-4 w-4" />
                ) : (
                  <Crosshair className="h-4 w-4" />
                )}
              </button>

              <div className="mx-1 h-5 w-px bg-gray-300" />

              <button
                type="button"
                onClick={zoomUt}
                className="rounded p-1.5 text-gray-500 transition-colors hover:bg-gray-200"
                title="Zoom ut"
              >
                <ZoomOut className="h-4 w-4" />
              </button>

              <span className="min-w-[3rem] text-center text-xs font-medium text-gray-600">
                {Math.round(zoom * 100)}%
              </span>

              <button
                type="button"
                onClick={zoomInn}
                className="rounded p-1.5 text-gray-500 transition-colors hover:bg-gray-200"
                title="Zoom inn"
              >
                <ZoomIn className="h-4 w-4" />
              </button>

              {zoom !== 1 && (
                <>
                  <div className="mx-1 h-5 w-px bg-gray-300" />
                  <button
                    type="button"
                    onClick={nullstillVisning}
                    className="rounded p-1.5 text-gray-500 transition-colors hover:bg-gray-200"
                    title="Nullstill visning"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div
          ref={containerRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={modus === "hånd" ? nullstillVisning : undefined}
          className="relative overflow-hidden bg-gray-100"
          style={{
            cursor:
              modus === "hånd"
                ? erDraging
                  ? "grabbing"
                  : "grab"
                : aktivtPunkt
                  ? "crosshair"
                  : "default",
            maxHeight: "calc(100vh - 350px)",
            minHeight: "400px",
          }}
        >
          <div
            ref={bildeRef}
            onClick={handleBildeKlikk}
            className="relative origin-center"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "center center",
            }}
          >
            {erBilde ? (
              <img
                src={`/api${tegning.fileUrl}`}
                alt={tegning.name}
                className="w-full"
                draggable={false}
              />
            ) : (
              <div className="relative">
                <iframe
                  src={`/api${tegning.fileUrl}#toolbar=0`}
                  title={tegning.name}
                  className="w-full border-0"
                  style={{ height: "800px" }}
                  scrolling="no"
                />
                {/* Permanent overlay — fanger alle mus/scroll-hendelser over PDF-iframe */}
                <div
                  className="absolute inset-0"
                  style={{
                    cursor:
                      modus === "hånd"
                        ? erDraging
                          ? "grabbing"
                          : "grab"
                        : aktivtPunkt
                          ? "crosshair"
                          : "default",
                  }}
                />
              </div>
            )}

          </div>

          {/* Markører — utenfor transformert div for fast størrelse */}
          {punkt1 && bildeRef.current && (() => {
            const b = bildeRef.current;
            const ox = b.offsetWidth / 2;
            const oy = b.offsetHeight / 2;
            const lx = (punkt1.pixel.x / 100) * b.offsetWidth;
            const ly = (punkt1.pixel.y / 100) * b.offsetHeight;
            const vx = (lx - ox) * zoom + ox + pan.x;
            const vy = (ly - oy) * zoom + oy + pan.y;
            return (
              <div
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: vx, top: vy }}
              >
                <div className="flex flex-col items-center">
                  <span className="mb-0.5 rounded bg-red-600 px-1 py-0.5 text-[9px] font-bold leading-none text-white">
                    1
                  </span>
                  <div className="h-2.5 w-2.5 rounded-full border-[1.5px] border-white bg-red-500 shadow" />
                </div>
              </div>
            );
          })()}

          {punkt2 && bildeRef.current && (() => {
            const b = bildeRef.current;
            const ox = b.offsetWidth / 2;
            const oy = b.offsetHeight / 2;
            const lx = (punkt2.pixel.x / 100) * b.offsetWidth;
            const ly = (punkt2.pixel.y / 100) * b.offsetHeight;
            const vx = (lx - ox) * zoom + ox + pan.x;
            const vy = (ly - oy) * zoom + oy + pan.y;
            return (
              <div
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: vx, top: vy }}
              >
                <div className="flex flex-col items-center">
                  <span className="mb-0.5 rounded bg-blue-600 px-1 py-0.5 text-[9px] font-bold leading-none text-white">
                    2
                  </span>
                  <div className="h-2.5 w-2.5 rounded-full border-[1.5px] border-white bg-blue-500 shadow" />
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Referansepunkt-skjema */}
      <div className="grid grid-cols-2 gap-6">
        {/* Punkt 1 */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                1
              </div>
              <h4 className="text-sm font-semibold text-gray-900">
                Referansepunkt 1
              </h4>
            </div>
            <Button
              size="sm"
              variant={aktivtPunkt === 1 ? "primary" : "secondary"}
              onClick={() => setAktivtPunkt(aktivtPunkt === 1 ? null : 1)}
            >
              <MapPin className="mr-1 h-3 w-3" />
              {punkt1 ? "Flytt" : "Plasser"}
            </Button>
          </div>

          {punkt1 ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-gray-400">
                Piksel: {punkt1.pixel.x}%, {punkt1.pixel.y}%
              </p>
              <Input
                label="Lim inn koordinater"
                value=""
                onChange={(e) => {
                  const resultat = parserKoordinater(e.target.value);
                  if (resultat) {
                    setPunkt1((p) => p ? { ...p, gps: resultat } : p);
                  }
                }}
                placeholder="Nord 7731109 Øst 652332 / 69.644, 18.923"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Breddegrad"
                  value={punkt1.gps.lat}
                  onChange={(e) =>
                    setPunkt1((p) =>
                      p ? { ...p, gps: { ...p.gps, lat: e.target.value } } : p,
                    )
                  }
                  placeholder="59.911"
                />
                <Input
                  label="Lengdegrad"
                  value={punkt1.gps.lng}
                  onChange={(e) =>
                    setPunkt1((p) =>
                      p ? { ...p, gps: { ...p.gps, lng: e.target.value } } : p,
                    )
                  }
                  placeholder="10.750"
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">
              Klikk &quot;Plasser&quot; og trykk på tegningen
            </p>
          )}
        </div>

        {/* Punkt 2 */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white">
                2
              </div>
              <h4 className="text-sm font-semibold text-gray-900">
                Referansepunkt 2
              </h4>
            </div>
            <Button
              size="sm"
              variant={aktivtPunkt === 2 ? "primary" : "secondary"}
              onClick={() => setAktivtPunkt(aktivtPunkt === 2 ? null : 2)}
            >
              <MapPin className="mr-1 h-3 w-3" />
              {punkt2 ? "Flytt" : "Plasser"}
            </Button>
          </div>

          {punkt2 ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-gray-400">
                Piksel: {punkt2.pixel.x}%, {punkt2.pixel.y}%
              </p>
              <Input
                label="Lim inn koordinater"
                value=""
                onChange={(e) => {
                  const resultat = parserKoordinater(e.target.value);
                  if (resultat) {
                    setPunkt2((p) => p ? { ...p, gps: resultat } : p);
                  }
                }}
                placeholder="Nord 7731109 Øst 652332 / 69.644, 18.923"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Breddegrad"
                  value={punkt2.gps.lat}
                  onChange={(e) =>
                    setPunkt2((p) =>
                      p ? { ...p, gps: { ...p.gps, lat: e.target.value } } : p,
                    )
                  }
                  placeholder="59.912"
                />
                <Input
                  label="Lengdegrad"
                  value={punkt2.gps.lng}
                  onChange={(e) =>
                    setPunkt2((p) =>
                      p ? { ...p, gps: { ...p.gps, lng: e.target.value } } : p,
                    )
                  }
                  placeholder="10.760"
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">
              Klikk &quot;Plasser&quot; og trykk på tegningen
            </p>
          )}
        </div>
      </div>

      {/* Handlinger */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleLagre}
          disabled={!kanLagre || settGeoMutasjon.isPending}
        >
          <Check className="mr-1.5 h-4 w-4" />
          {settGeoMutasjon.isPending ? "Lagrer..." : "Lagre kalibrering"}
        </Button>

        {eksisterende && (
          <Button
            variant="danger"
            onClick={() => fjernGeoMutasjon.mutate({ drawingId: tegningId })}
            disabled={fjernGeoMutasjon.isPending}
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            {fjernGeoMutasjon.isPending ? "Fjerner..." : "Fjern kalibrering"}
          </Button>
        )}
      </div>
    </div>
  );
}
