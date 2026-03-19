"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button, Input } from "@sitedoc/ui";
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
import type { GeoReferanse } from "@sitedoc/shared";

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

  // UTM33-format: Finn Nord- og Øst-verdier uavhengig av rekkefølge og format
  // Støtter: "Nord 7731109 Øst 652332", "Øst: 653657.15 Nord: 7732863.73", etc.
  const nordMatch = trimmet.match(/[Nn]ord:?\s*(\d{6,8}[.,]?\d*)/);
  const ostMatch = trimmet.match(/[ØøOo]st:?\s*(\d{5,7}[.,]?\d*)/);
  if (nordMatch?.[1] && ostMatch?.[1]) {
    const nord = Number(nordMatch[1].replace(",", "."));
    const ost = Number(ostMatch[1].replace(",", "."));
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

  // Zoom og panorering — samlet state for atomiske oppdateringer
  const [view, setView] = useState({ zoom: 1, panX: 0, panY: 0 });
  const [erDraging, setErDraging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const harDratt = useRef(false); // Forhindrer klikk-plassering etter drag
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
  const [lagreStatus, setLagreStatus] = useState<"idle" | "lagret" | "feil">("idle");
  const [limTekst1, setLimTekst1] = useState("");
  const [limTekst2, setLimTekst2] = useState("");

  const settGeoMutasjon = trpc.tegning.settGeoReferanse.useMutation({
    onSuccess: () => {
      utils.bygning.hentMedId.invalidate();
      utils.tegning.hentMedId.invalidate({ id: tegningId });
      setLagreStatus("lagret");
      setTimeout(() => setLagreStatus("idle"), 3000);
      onLagret();
    },
    onError: () => {
      setLagreStatus("feil");
      setTimeout(() => setLagreStatus("idle"), 4000);
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
      if (harDratt.current) { harDratt.current = false; return; }
      const container = containerRef.current;
      const bilde = bildeRef.current;
      if (!container || !bilde) return;

      // Inverter CSS-transform: translate(pan) scale(zoom) med origin 0 0
      // Visuell posisjon: vx = lx * zoom + pan.x → lokal: lx = (vx - pan.x) / zoom
      const containerRect = container.getBoundingClientRect();
      const klikkX = e.clientX - containerRect.left;
      const klikkY = e.clientY - containerRect.top;
      const lokalX = (klikkX - view.panX) / view.zoom;
      const lokalY = (klikkY - view.panY) / view.zoom;

      const bildeBredd = bilde.offsetWidth;
      const bildeHoyde = bilde.offsetHeight;
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
    [aktivtPunkt, modus, view],
  );

  // Native wheel-listener med { passive: false } — React onWheel kan være passiv
  // og tillater ikke preventDefault(), som gjør at siden scroller i stedet for å zoome.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const containerRect = container.getBoundingClientRect();
      const cx = e.clientX - containerRect.left;
      const cy = e.clientY - containerRect.top;

      // Atomisk oppdatering av zoom + pan i én setView-kall
      setView((prev) => {
        const faktor = e.deltaY > 0 ? 0.85 : 1.18;
        const nesteZoom = Math.min(10, Math.max(1, prev.zoom * faktor));
        if (nesteZoom === prev.zoom) return prev;

        // Zoom mot musepekeren med transformOrigin: 0 0
        // Behold punktet under cursoren fast:
        // cx = lx * zoom + panX → lx = (cx - panX) / zoom
        // panX_ny = panX - lx * (zoom_ny - zoom_gammel)
        const lx = (cx - prev.panX) / prev.zoom;
        const ly = (cy - prev.panY) / prev.zoom;
        const dz = nesteZoom - prev.zoom;

        return {
          zoom: nesteZoom,
          panX: prev.panX - lx * dz,
          panY: prev.panY - ly * dz,
        };
      });
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (modus !== "hånd" && !aktivtPunkt) return;
      if (modus === "hånd") {
        e.preventDefault();
        setErDraging(true);
        harDratt.current = false;
        dragStart.current = { x: e.clientX, y: e.clientY, panX: view.panX, panY: view.panY };
      }
    },
    [modus, view, aktivtPunkt],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!erDraging) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      // Merk som dratt hvis musen har beveget seg mer enn 3px
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) harDratt.current = true;
      setView((prev) => ({
        ...prev,
        panX: dragStart.current.panX + dx,
        panY: dragStart.current.panY + dy,
      }));
    },
    [erDraging],
  );

  const handleMouseUp = useCallback(() => {
    setErDraging(false);
  }, []);

  const nullstillVisning = useCallback(() => {
    setView({ zoom: 1, panX: 0, panY: 0 });
  }, []);

  // Zoom mot midten av synlig område (for knappene)
  const zoomMotMidten = useCallback((faktor: number) => {
    const container = containerRef.current;
    if (!container) return;
    const cx = container.offsetWidth / 2;
    const cy = container.offsetHeight / 2;

    setView((prev) => {
      const nesteZoom = Math.min(10, Math.max(1, prev.zoom * faktor));
      if (nesteZoom === prev.zoom) return prev;

      const lx = (cx - prev.panX) / prev.zoom;
      const ly = (cy - prev.panY) / prev.zoom;
      const dz = nesteZoom - prev.zoom;
      return {
        zoom: nesteZoom,
        panX: prev.panX - lx * dz,
        panY: prev.panY - ly * dz,
      };
    });
  }, []);

  const zoomInn = useCallback(() => zoomMotMidten(1.3), [zoomMotMidten]);
  const zoomUt = useCallback(() => zoomMotMidten(1 / 1.3), [zoomMotMidten]);

  const punkt1Gyldig =
    punkt1 &&
    punkt1.gps.lat &&
    punkt1.gps.lng &&
    !isNaN(Number(punkt1.gps.lat)) &&
    !isNaN(Number(punkt1.gps.lng));

  const punkt2Gyldig =
    punkt2 &&
    punkt2.gps.lat &&
    punkt2.gps.lng &&
    !isNaN(Number(punkt2.gps.lat)) &&
    !isNaN(Number(punkt2.gps.lng));

  const erIdentiske =
    punkt1Gyldig &&
    punkt2Gyldig &&
    Number(punkt1!.gps.lat) === Number(punkt2!.gps.lat) &&
    Number(punkt1!.gps.lng) === Number(punkt2!.gps.lng);

  const kanLagre = punkt1Gyldig && punkt2Gyldig && !erIdentiske;

  // Lagre enkeltpunkt midlertidig i komponent-state (markert med ✓)
  const [punkt1Lagret, setPunkt1Lagret] = useState(!!eksisterende?.point1);
  const [punkt2Lagret, setPunkt2Lagret] = useState(!!eksisterende?.point2);

  function handleLagrePunkt(punktNr: 1 | 2) {
    if (punktNr === 1) setPunkt1Lagret(true);
    else setPunkt2Lagret(true);
  }

  // Nullstill "lagret"-markør når punkt endres
  useEffect(() => { setPunkt1Lagret(false); }, [punkt1?.gps.lat, punkt1?.gps.lng, punkt1?.pixel.x, punkt1?.pixel.y]);
  useEffect(() => { setPunkt2Lagret(false); }, [punkt2?.gps.lat, punkt2?.gps.lng, punkt2?.pixel.x, punkt2?.pixel.y]);

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
    <div className="flex h-[calc(100vh-200px)] min-h-[500px] gap-4">
      {/* Venstre: Tegning med klikkbare punkter */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="flex-shrink-0 border-b border-gray-200 bg-gray-50 px-3 py-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium text-gray-700">{tegning.name}</p>
              {aktivtPunkt && (
                <span className="flex-shrink-0 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                  Klikk for punkt {aktivtPunkt}
                </span>
              )}
            </div>

            {/* Verktøylinje */}
            <div className="flex flex-shrink-0 items-center gap-1">
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
                {Math.round(view.zoom * 100)}%
              </span>

              <button
                type="button"
                onClick={zoomInn}
                className="rounded p-1.5 text-gray-500 transition-colors hover:bg-gray-200"
                title="Zoom inn"
              >
                <ZoomIn className="h-4 w-4" />
              </button>

              {view.zoom !== 1 && (
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
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={modus === "hånd" ? nullstillVisning : undefined}
          className="relative flex-1 overflow-hidden bg-gray-100"
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
        >
          <div
            ref={bildeRef}
            onClick={handleBildeKlikk}
            className="relative"
            style={{
              transform: `translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})`,
              transformOrigin: "0 0",
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

          {/* Markører */}
          {punkt1 && bildeRef.current && (() => {
            const b = bildeRef.current;
            const lx = (punkt1.pixel.x / 100) * b.offsetWidth;
            const ly = (punkt1.pixel.y / 100) * b.offsetHeight;
            const vx = lx * view.zoom + view.panX;
            const vy = ly * view.zoom + view.panY;
            return (
              <div
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: vx, top: vy }}
              >
                <div className="flex flex-col items-center">
                  <span className="mb-0.5 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                    1
                  </span>
                  <div className="h-3 w-3 rounded-full border-2 border-white bg-red-500 shadow" />
                </div>
              </div>
            );
          })()}

          {punkt2 && bildeRef.current && (() => {
            const b = bildeRef.current;
            const lx = (punkt2.pixel.x / 100) * b.offsetWidth;
            const ly = (punkt2.pixel.y / 100) * b.offsetHeight;
            const vx = lx * view.zoom + view.panX;
            const vy = ly * view.zoom + view.panY;
            return (
              <div
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: vx, top: vy }}
              >
                <div className="flex flex-col items-center">
                  <span className="mb-0.5 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                    2
                  </span>
                  <div className="h-3 w-3 rounded-full border-2 border-white bg-blue-500 shadow" />
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Høyre: Referansepunkter og handlinger */}
      <div className="flex w-80 flex-shrink-0 flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Georeferanse</h3>
          <a
            href="https://norgeskart.no"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Norgeskart
          </a>
        </div>

        {/* Punkt 1 */}
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                1
              </div>
              <h4 className="text-xs font-semibold text-gray-900">Punkt 1</h4>
              {punkt1 && (
                <span className="text-[10px] text-gray-400">
                  ({punkt1.pixel.x}%, {punkt1.pixel.y}%)
                </span>
              )}
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
            <div className="flex flex-col gap-1.5">
              <Input
                label="Lim inn koordinater"
                value={limTekst1}
                onChange={(e) => {
                  const v = e.target.value;
                  setLimTekst1(v);
                  const resultat = parserKoordinater(v);
                  if (resultat) {
                    setPunkt1((p) => p ? { ...p, gps: resultat } : p);
                  }
                }}
                placeholder="Lim inn fra Norgeskart"
              />
              <div className="grid grid-cols-2 gap-1.5">
                <Input
                  label="Breddegrad"
                  value={punkt1.gps.lat}
                  onChange={(e) =>
                    setPunkt1((p) =>
                      p ? { ...p, gps: { ...p.gps, lat: e.target.value } } : p,
                    )
                  }
                  placeholder="f.eks. 59.911"
                />
                <Input
                  label="Lengdegrad"
                  value={punkt1.gps.lng}
                  onChange={(e) =>
                    setPunkt1((p) =>
                      p ? { ...p, gps: { ...p.gps, lng: e.target.value } } : p,
                    )
                  }
                  placeholder="f.eks. 10.750"
                />
              </div>
              <button
                type="button"
                onClick={() => handleLagrePunkt(1)}
                disabled={!punkt1Gyldig}
                className={`flex items-center justify-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                  punkt1Lagret
                    ? "bg-green-50 text-green-700"
                    : punkt1Gyldig
                      ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
                      : "bg-gray-50 text-gray-400"
                }`}
              >
                <Check className="h-3 w-3" />
                {punkt1Lagret ? "Punkt 1 bekreftet" : "Bekreft punkt 1"}
              </button>
            </div>
          ) : (
            <p className="text-xs text-gray-400">
              Klikk &quot;Plasser&quot; og trykk på tegningen
            </p>
          )}
        </div>

        {/* Punkt 2 */}
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">
                2
              </div>
              <h4 className="text-xs font-semibold text-gray-900">Punkt 2</h4>
              {punkt2 && (
                <span className="text-[10px] text-gray-400">
                  ({punkt2.pixel.x}%, {punkt2.pixel.y}%)
                </span>
              )}
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
            <div className="flex flex-col gap-1.5">
              <Input
                label="Lim inn koordinater"
                value={limTekst2}
                onChange={(e) => {
                  const v = e.target.value;
                  setLimTekst2(v);
                  const resultat = parserKoordinater(v);
                  if (resultat) {
                    setPunkt2((p) => p ? { ...p, gps: resultat } : p);
                  }
                }}
                placeholder="Lim inn fra Norgeskart"
              />
              <div className="grid grid-cols-2 gap-1.5">
                <Input
                  label="Breddegrad"
                  value={punkt2.gps.lat}
                  onChange={(e) =>
                    setPunkt2((p) =>
                      p ? { ...p, gps: { ...p.gps, lat: e.target.value } } : p,
                    )
                  }
                  placeholder="f.eks. 59.912"
                />
                <Input
                  label="Lengdegrad"
                  value={punkt2.gps.lng}
                  onChange={(e) =>
                    setPunkt2((p) =>
                      p ? { ...p, gps: { ...p.gps, lng: e.target.value } } : p,
                    )
                  }
                  placeholder="f.eks. 10.760"
                />
              </div>
              <button
                type="button"
                onClick={() => handleLagrePunkt(2)}
                disabled={!punkt2Gyldig}
                className={`flex items-center justify-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                  punkt2Lagret
                    ? "bg-green-50 text-green-700"
                    : punkt2Gyldig
                      ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
                      : "bg-gray-50 text-gray-400"
                }`}
              >
                <Check className="h-3 w-3" />
                {punkt2Lagret ? "Punkt 2 bekreftet" : "Bekreft punkt 2"}
              </button>
            </div>
          ) : (
            <p className="text-xs text-gray-400">
              Klikk &quot;Plasser&quot; og trykk på tegningen
            </p>
          )}
        </div>

        {/* Handlinger — alltid synlige nederst */}
        <div className="mt-auto flex flex-col gap-2">
          {lagreStatus === "lagret" && (
            <div className="flex items-center gap-1.5 rounded-md bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
              <Check className="h-4 w-4" />
              Kalibrering lagret
            </div>
          )}
          {lagreStatus === "feil" && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              Kunne ikke lagre — prøv igjen
            </div>
          )}

          {erIdentiske && (
            <div className="rounded-md bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
              Punkt 1 og 2 har identiske GPS-koordinater. Velg to ulike punkter.
            </div>
          )}

          <Button
            onClick={handleLagre}
            disabled={!kanLagre || !punkt1Lagret || !punkt2Lagret || settGeoMutasjon.isPending}
            className="w-full"
          >
            <Check className="mr-1.5 h-4 w-4" />
            {settGeoMutasjon.isPending
              ? "Lagrer..."
              : !punkt1Lagret || !punkt2Lagret
                ? "Bekreft begge punkter først"
                : "Lagre kalibrering"}
          </Button>

          {eksisterende && (
            <Button
              variant="danger"
              onClick={() => fjernGeoMutasjon.mutate({ drawingId: tegningId })}
              disabled={fjernGeoMutasjon.isPending}
              className="w-full"
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              {fjernGeoMutasjon.isPending ? "Fjerner..." : "Fjern kalibrering"}
            </Button>
          )}
        </div>

        <p className="text-[10px] text-gray-400">
          Plasser to punkter og oppgi GPS-koordinater. Scroll for å zoome, bruk hånd-modus for å panorere.
        </p>
      </div>
    </div>
  );
}
