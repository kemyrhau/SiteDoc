"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button, Input } from "@sitedoc/ui";
import {
  MapPin,
  Trash2,
  Check,
  Hand,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Crosshair,
  Map,
  ChevronDown,
  ChevronUp,
  LocateFixed,
} from "lucide-react";
import type { GeoReferanse } from "@sitedoc/shared";
import { utmTilWgs84, EPSG_TIL_SYSTEM as SHARED_EPSG } from "@sitedoc/shared/utils";
import type L_Type from "leaflet";

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

/** Støttede koordinatsystemer */
type KoordinatSystem = "wgs84" | "utm32" | "utm33" | "utm35" | "utm36";

const KOORDINAT_SYSTEMER: { verdi: KoordinatSystem; label: string }[] = [
  { verdi: "wgs84", label: "WGS84 (Lat/Lon)" },
  { verdi: "utm32", label: "ETRS89 UTM-32" },
  { verdi: "utm33", label: "ETRS89 UTM-33" },
  { verdi: "utm35", label: "ETRS89 UTM-35" },
  { verdi: "utm36", label: "ETRS89 UTM-36" },
];

/** UTM-konvertering via delt pakke */
function utmTilLatLng(nord: number, ost: number, sone: string): { lat: number; lng: number } {
  return utmTilWgs84(nord, ost, sone);
}

/** EPSG-kode → intern KoordinatSystem-mapping (fra delt pakke, filtrert for UTM) */
const EPSG_TIL_SYSTEM: Record<string, KoordinatSystem> = {
  "25832": "utm32",
  "25833": "utm33",
  "25835": "utm35",
  "25836": "utm36",
  ...Object.fromEntries(
    Object.entries(SHARED_EPSG).filter(([, v]) => v.startsWith("utm"))
  ),
};

/** Parser og konverter koordinater basert på valgt koordinatsystem */
function parserKoordinater(tekst: string, system: KoordinatSystem): { lat: string; lng: string } | null {
  const trimmet = tekst.trim();

  // Norgeskart kompaktformat: "653849.51,7732794.51@EPSG:25833"
  const norgeskartMatch = trimmet.match(/^(\d{5,7}[.,]?\d*)\s*,\s*(\d{6,8}[.,]?\d*)@EPSG:(\d{5})$/i);
  if (norgeskartMatch?.[1] && norgeskartMatch[2] && norgeskartMatch[3]) {
    const ost = Number(norgeskartMatch[1].replace(",", "."));
    const nord = Number(norgeskartMatch[2].replace(",", "."));
    const epsgSone = EPSG_TIL_SYSTEM[norgeskartMatch[3]];
    const brukSone = epsgSone ?? system;
    if (nord > 6000000 && nord < 8500000 && ost > 100000 && ost < 900000 && brukSone !== "wgs84") {
      const resultat = utmTilLatLng(nord, ost, brukSone);
      return { lat: resultat.lat.toFixed(6), lng: resultat.lng.toFixed(6) };
    }
  }

  if (system !== "wgs84") {
    // UTM-format: "Nord: xxx Øst: yyy" eller "Øst: xxx\nNord: yyy" (flerlinjet fra Norgeskart)
    const nordMatch = trimmet.match(/[Nn]ord:?\s*(\d{6,8}[.,]?\d*)/);
    const ostMatch = trimmet.match(/[ØøOo]st:?\s*(\d{5,7}[.,]?\d*)/);
    if (nordMatch?.[1] && ostMatch?.[1]) {
      const nord = Number(nordMatch[1].replace(",", "."));
      const ost = Number(ostMatch[1].replace(",", "."));
      if (nord > 6000000 && nord < 8500000 && ost > 100000 && ost < 900000) {
        const resultat = utmTilLatLng(nord, ost, system);
        return { lat: resultat.lat.toFixed(6), lng: resultat.lng.toFixed(6) };
      }
    }

    // Bare to tall: easting,northing (Norgeskart-rekkefølge) eller northing easting
    const tallMatch = trimmet.match(/^(\d{5,8}[.,]?\d*)[,\s]+(\d{5,8}[.,]?\d*)$/);
    if (tallMatch?.[1] && tallMatch[2]) {
      const a = Number(tallMatch[1].replace(",", "."));
      const b = Number(tallMatch[2].replace(",", "."));
      // Autodetekter rekkefølge: det store tallet (>6M) er northing
      if (b > 6000000 && a < 900000) {
        // a=øst, b=nord (Norgeskart: Øst,Nord)
        const resultat = utmTilLatLng(b, a, system);
        return { lat: resultat.lat.toFixed(6), lng: resultat.lng.toFixed(6) };
      }
      if (a > 6000000 && b < 900000) {
        // a=nord, b=øst (standard)
        const resultat = utmTilLatLng(a, b, system);
        return { lat: resultat.lat.toFixed(6), lng: resultat.lng.toFixed(6) };
      }
    }

    return null;
  }

  // WGS84: Desimalformat
  const desimalMatch = trimmet.match(/^(-?\d+[.,]\d+)[,\s]+(-?\d+[.,]\d+)$/);
  if (desimalMatch?.[1] && desimalMatch[2]) {
    return {
      lat: desimalMatch[1].replace(",", "."),
      lng: desimalMatch[2].replace(",", "."),
    };
  }

  // WGS84: DMS-format
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

/** Mini-kart for å velge GPS-koordinat ved å klikke */
function KoordinatKart({
  lat,
  lng,
  onVelg,
  farge,
}: {
  lat: string;
  lng: string;
  onVelg: (lat: string, lng: string) => void;
  farge: string;
}) {
  const kartRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L_Type.Map | null>(null);
  const markerRef = useRef<L_Type.Marker | null>(null);
  const LRef = useRef<typeof L_Type | null>(null);

  const senterLat = lat && !isNaN(Number(lat)) ? Number(lat) : 65;
  const senterLng = lng && !isNaN(Number(lng)) ? Number(lng) : 13;
  const harKoordinat = lat && lng && !isNaN(Number(lat)) && !isNaN(Number(lng));

  useEffect(() => {
    if (!kartRef.current || mapRef.current) return;

    let avbrutt = false;

    async function initKart() {
      const L = await import("leaflet");
      if (avbrutt || !kartRef.current) return;

      // Injiser Leaflet CSS hvis den ikke allerede finnes
      if (!document.querySelector("link[href*='leaflet']")) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }
      LRef.current = L.default ?? L;
      const Lib = LRef.current;

      const map = Lib.map(kartRef.current, {
        center: [senterLat, senterLng],
        zoom: harKoordinat ? 17 : 5,
        zoomControl: false,
      });

      // Norge i Bilder (satellitt) som hovedlag
      const satellitt = Lib.tileLayer(
        "https://waapi.webatlas.no/maptiles/tiles/webatlas-orto-newup/wa_grid/{z}/{x}/{y}.jpeg?api_key=b8e36d51-119a-423b-b156-d744d54123d5",
        { attribution: "Norkart/Geovekst", maxZoom: 20 },
      );
      // OpenStreetMap som fallback
      const osm = Lib.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        { attribution: "&copy; OSM", maxZoom: 19 },
      );
      // Kartverket topografisk
      const topo = Lib.tileLayer(
        "https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png",
        { attribution: "&copy; Kartverket", maxZoom: 18 },
      );

      satellitt.addTo(map);

      Lib.control.layers(
        { "Satellitt": satellitt, "Kart": osm, "Topo": topo },
        {},
        { position: "topleft", collapsed: true },
      ).addTo(map);

      Lib.control.zoom({ position: "topright" }).addTo(map);

      const markerIkon = Lib.divIcon({
        className: "",
        html: `<div style="width:14px;height:14px;border-radius:50%;background:${farge};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4);"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      if (harKoordinat) {
        markerRef.current = Lib.marker([senterLat, senterLng], { icon: markerIkon }).addTo(map);
      }

      map.on("click", (e: L_Type.LeafletMouseEvent) => {
        const { lat: nyLat, lng: nyLng } = e.latlng;
        onVelg(nyLat.toFixed(6), nyLng.toFixed(6));

        if (markerRef.current) {
          markerRef.current.setLatLng([nyLat, nyLng]);
        } else {
          markerRef.current = Lib.marker([nyLat, nyLng], { icon: markerIkon }).addTo(map);
        }
      });

      mapRef.current = map;
      setTimeout(() => map.invalidateSize(), 100);
    }

    initKart();

    return () => {
      avbrutt = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
    // Kun kjør ved mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Oppdater markør når koordinater endres eksternt
  useEffect(() => {
    if (!mapRef.current || !LRef.current) return;
    if (!harKoordinat) return;

    const Lib = LRef.current;
    const map = mapRef.current;
    const pos: L_Type.LatLngExpression = [Number(lat), Number(lng)];

    if (markerRef.current) {
      markerRef.current.setLatLng(pos);
    } else {
      const markerIkon = Lib.divIcon({
        className: "",
        html: `<div style="width:14px;height:14px;border-radius:50%;background:${farge};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4);"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      markerRef.current = Lib.marker(pos, { icon: markerIkon }).addTo(map);
    }

    map.setView(pos, Math.max(map.getZoom(), 15));
  }, [lat, lng, harKoordinat, farge]);

  return (
    <div
      ref={kartRef}
      className="rounded border border-gray-200"
      style={{ height: 180, width: "100%" }}
    />
  );
}

export function GeoReferanseEditor({
  tegningId,
  tegning,
  onLagret,
}: GeoReferanseEditorProps) {
  const utils = trpc.useUtils();
  const bildeRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [view, setView] = useState({ zoom: 1, panX: 0, panY: 0 });
  const [erDraging, setErDraging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const harDratt = useRef(false);
  const [modus, setModus] = useState<"peker" | "hånd">("peker");

  const eksisterende = tegning?.geoReference as GeoReferanse | null | undefined;

  const konverterMutation = trpc.tegning.provKonverteringIgjen.useMutation({
    onSuccess: () => {
      utils.tegning.hentMedId.invalidate({ id: tegningId });
      utils.bygning.hentMedId.invalidate();
      onLagret();
    },
  });

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
  const [visKart1, setVisKart1] = useState(false);
  const [visKart2, setVisKart2] = useState(false);
  const [visLimInn1, setVisLimInn1] = useState(false);
  const [visLimInn2, setVisLimInn2] = useState(false);
  const [koordinatSystem, setKoordinatSystem] = useState<KoordinatSystem>("utm33");

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

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const containerRect = container.getBoundingClientRect();
      const cx = e.clientX - containerRect.left;
      const cy = e.clientY - containerRect.top;

      setView((prev) => {
        const faktor = e.deltaY > 0 ? 0.85 : 1.18;
        const nesteZoom = Math.min(10, Math.max(0.1, prev.zoom * faktor));
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

  const zoomMotMidten = useCallback((faktor: number) => {
    const container = containerRef.current;
    if (!container) return;
    const cx = container.offsetWidth / 2;
    const cy = container.offsetHeight / 2;

    setView((prev) => {
      const nesteZoom = Math.min(10, Math.max(0.1, prev.zoom * faktor));
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

  // Låst-state per punkt — forhindrer at data overskrives ved uhell
  const [punkt1Låst, setPunkt1Låst] = useState(!!eksisterende?.point1);
  const [punkt2Låst, setPunkt2Låst] = useState(!!eksisterende?.point2);

  // Nullstill lås når punkt endres
  useEffect(() => { setPunkt1Låst(false); }, [punkt1?.gps.lat, punkt1?.gps.lng, punkt1?.pixel.x, punkt1?.pixel.y]);
  useEffect(() => { setPunkt2Låst(false); }, [punkt2?.gps.lat, punkt2?.gps.lng, punkt2?.pixel.x, punkt2?.pixel.y]);

  function hentMinPosisjon(punktNr: 1 | 2) {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const gps = { lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) };
        if (punktNr === 1) {
          setPunkt1((p) => p ? { ...p, gps } : p);
        } else {
          setPunkt2((p) => p ? { ...p, gps } : p);
        }
      },
      (err) => {
        console.warn("Geolocation feil:", err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

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

  const filType = tegning.fileType ?? "";
  const erBilde = ["png", "jpg", "jpeg", "svg"].includes(filType);
  const erDwg = filType === "dwg";

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
            {erDwg ? (
              <div className="flex h-[400px] w-full flex-col items-center justify-center gap-3 bg-gray-100">
                <p className="text-sm text-gray-500">DWG-filen må konverteres før georeferering er mulig</p>
                <button
                  onClick={() => konverterMutation.mutate({ id: tegningId })}
                  disabled={konverterMutation.isPending}
                  className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
                >
                  {konverterMutation.isPending ? "Starter konvertering..." : "Konverter DWG"}
                </button>
                {konverterMutation.isSuccess && (
                  <p className="text-xs text-green-600">Konvertering startet — last inn siden på nytt om et øyeblikk</p>
                )}
              </div>
            ) : erBilde ? (
              <img
                src={`/api${tegning.fileUrl}`}
                alt={tegning.name}
                className="block w-full"
                draggable={false}
                onLoad={() => console.log("[GeoRef] Bilde lastet:", tegning.fileUrl, tegning.fileType)}
                onError={(e) => console.error("[GeoRef] Bilde feilet:", tegning.fileUrl, e)}
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
                <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-red-500 shadow-md">
                  <span className="text-[10px] font-bold leading-none text-white">1</span>
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
                <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-blue-500 shadow-md">
                  <span className="text-[10px] font-bold leading-none text-white">2</span>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Høyre: Referansepunkter og handlinger */}
      <div className="flex w-96 flex-shrink-0 flex-col gap-3 overflow-y-auto">
        <h3 className="text-sm font-semibold text-gray-900">Georeferanse</h3>

        {/* Koordinatsystem-velger */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-2">
          <label className="mb-1 block text-[10px] font-medium text-gray-500">
            Koordinatsystem (for innliming)
          </label>
          <select
            value={koordinatSystem}
            onChange={(e) => setKoordinatSystem(e.target.value as KoordinatSystem)}
            className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700"
          >
            {KOORDINAT_SYSTEMER.map((sys) => (
              <option key={sys.verdi} value={sys.verdi}>
                {sys.label}
              </option>
            ))}
          </select>
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
              {/* Kart + min posisjon for punkt 1 */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setVisKart1((v) => !v)}
                  className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
                >
                  <Map className="h-3 w-3" />
                  Velg på kart
                  {visKart1 ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
                <button
                  type="button"
                  onClick={() => hentMinPosisjon(1)}
                  className="flex items-center gap-1 text-xs font-medium text-green-600 hover:text-green-800"
                  title="Bruk nettleserens GPS-posisjon"
                >
                  <LocateFixed className="h-3 w-3" />
                  Min posisjon
                </button>
              </div>
              {visKart1 && (
                <KoordinatKart
                  lat={punkt1.gps.lat}
                  lng={punkt1.gps.lng}
                  farge="#ef4444"
                  onVelg={(lat, lng) =>
                    setPunkt1((p) => p ? { ...p, gps: { lat, lng } } : p)
                  }
                />
              )}

              {/* Lim inn (sammenfoldet) */}
              <button
                type="button"
                onClick={() => setVisLimInn1((v) => !v)}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
              >
                Lim inn koordinater
                {visLimInn1 ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
              {visLimInn1 && (
                <Input
                  label=""
                  value={limTekst1}
                  onChange={(e) => {
                    const v = e.target.value;
                    setLimTekst1(v);
                    const resultat = parserKoordinater(v, koordinatSystem);
                    if (resultat) {
                      setPunkt1((p) => p ? { ...p, gps: resultat } : p);
                    }
                  }}
                  placeholder={koordinatSystem === "wgs84" ? "F.eks. 69.659, 18.963" : "F.eks. Nord: 7731109 Øst: 652332"}
                />
              )}

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
              {punkt1Gyldig && (
                <button
                  type="button"
                  onClick={() => setPunkt1Låst(true)}
                  disabled={punkt1Låst}
                  className={`flex w-full items-center justify-center gap-1 rounded px-2 py-1.5 text-xs font-medium transition-colors ${
                    punkt1Låst
                      ? "bg-green-50 text-green-700"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  <Check className="h-3 w-3" />
                  {punkt1Låst ? "Punkt 1 lagret" : "Lagre punkt 1"}
                </button>
              )}
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
              {/* Kart + min posisjon for punkt 2 */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setVisKart2((v) => !v)}
                  className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
                >
                  <Map className="h-3 w-3" />
                  Velg på kart
                  {visKart2 ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
                <button
                  type="button"
                  onClick={() => hentMinPosisjon(2)}
                  className="flex items-center gap-1 text-xs font-medium text-green-600 hover:text-green-800"
                  title="Bruk nettleserens GPS-posisjon"
                >
                  <LocateFixed className="h-3 w-3" />
                  Min posisjon
                </button>
              </div>
              {visKart2 && (
                <KoordinatKart
                  lat={punkt2.gps.lat}
                  lng={punkt2.gps.lng}
                  farge="#3b82f6"
                  onVelg={(lat, lng) =>
                    setPunkt2((p) => p ? { ...p, gps: { lat, lng } } : p)
                  }
                />
              )}

              {/* Lim inn (sammenfoldet) */}
              <button
                type="button"
                onClick={() => setVisLimInn2((v) => !v)}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
              >
                Lim inn koordinater
                {visLimInn2 ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
              {visLimInn2 && (
                <Input
                  label=""
                  value={limTekst2}
                  onChange={(e) => {
                    const v = e.target.value;
                    setLimTekst2(v);
                    const resultat = parserKoordinater(v, koordinatSystem);
                    if (resultat) {
                      setPunkt2((p) => p ? { ...p, gps: resultat } : p);
                    }
                  }}
                  placeholder={koordinatSystem === "wgs84" ? "F.eks. 69.660, 18.965" : "F.eks. Nord: 7732000 Øst: 653000"}
                />
              )}

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
              {punkt2Gyldig && (
                <button
                  type="button"
                  onClick={() => setPunkt2Låst(true)}
                  disabled={punkt2Låst}
                  className={`flex w-full items-center justify-center gap-1 rounded px-2 py-1.5 text-xs font-medium transition-colors ${
                    punkt2Låst
                      ? "bg-green-50 text-green-700"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  <Check className="h-3 w-3" />
                  {punkt2Låst ? "Punkt 2 lagret" : "Lagre punkt 2"}
                </button>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-400">
              Klikk &quot;Plasser&quot; og trykk på tegningen
            </p>
          )}
        </div>

        {/* Handlinger */}
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
            disabled={!kanLagre || !punkt1Låst || !punkt2Låst || settGeoMutasjon.isPending}
            className="w-full"
          >
            <Check className="mr-1.5 h-4 w-4" />
            {settGeoMutasjon.isPending
              ? "Lagrer..."
              : !punkt1Låst || !punkt2Låst
                ? "Lagre begge punkter først"
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
          1. Plasser punkt på tegningen. 2. Klikk &quot;Velg på kart&quot; og klikk tilsvarende posisjon på kartet. Gjenta for punkt 2.
        </p>
      </div>
    </div>
  );
}
