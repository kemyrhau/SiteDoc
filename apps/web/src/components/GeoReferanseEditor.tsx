"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
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
  ChevronDown,
  ChevronUp,
  LocateFixed,
  Plus,
  AlertTriangle,
  CheckCircle,
  Search,
} from "lucide-react";
import type { GeoReferanse } from "@sitedoc/shared";
import { utmTilWgs84, EPSG_TIL_SYSTEM as SHARED_EPSG, beregnKalibreringsFeil } from "@sitedoc/shared/utils";
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
  /** Byggeplass-id for adressesøk (auth-scoping i `bygning.geokod`). Fra parentens valgtId. */
  byggeplassId?: string | null;
  /** Startsenter for kartet (byggeplassens geofence-senter) — fallback (b). */
  startSenter?: { lat: number; lng: number } | null;
}

interface Punkt {
  pixel: { x: number; y: number };
  gps: { lat: string; lng: string };
}

/** Adressesøk-treff (speiler `bygning.geokod`-retur / rute-service AdresseTreff). */
interface AdresseTreff {
  lat: number;
  lng: number;
  label: string;
}

/** Punktfarger — delt kilde (drawing-markør + kartmarkør + badge) */
const PUNKT1_FARGE = "#ef4444"; // red-500
const PUNKT2_FARGE = "#3b82f6"; // blue-500
const EKSTRA_FARGE = "#10b981"; // emerald-500

function fargeForPunkt(nr: number): string {
  return nr === 1 ? PUNKT1_FARGE : nr === 2 ? PUNKT2_FARGE : EKSTRA_FARGE;
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

/** Delt markør-ikonfabrikk for kartet (nummerert pin) — ingen duplisering per punkt. */
function lagMarkorIkon(Lib: typeof L_Type, farge: string, label: string): L_Type.DivIcon {
  return Lib.divIcon({
    className: "",
    html: `<div style="display:flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:${farge};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4);color:white;font-size:10px;font-weight:700;line-height:1;">${label}</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

interface KartPunkt {
  nr: number;
  lat: number;
  lng: number;
  farge: string;
}

/**
 * Felles kart — ett Leaflet-kart som viser alle georef-markører. Kartklikk setter
 * GPS for det aktive punktet (chip-valgt); uten aktivt punkt gjør klikk ingenting.
 */
function FellesKart({
  punkter,
  aktivtKartPunkt,
  onKartKlikk,
  flyTil,
  startSenter,
}: {
  punkter: KartPunkt[];
  aktivtKartPunkt: number | null;
  onKartKlikk: (lat: number, lng: number) => void;
  flyTil: { lat: number; lng: number } | null;
  startSenter: { lat: number; lng: number } | null;
}) {
  const kartRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L_Type.Map | null>(null);
  const LRef = useRef<typeof L_Type | null>(null);
  const markorLagRef = useRef<L_Type.LayerGroup | null>(null);

  // Ferske verdier tilgjengelig i map-klikk-handleren (registreres kun ved mount)
  const aktivtRef = useRef(aktivtKartPunkt);
  const onKlikkRef = useRef(onKartKlikk);
  const punkterRef = useRef(punkter);
  const startSenterRef = useRef(startSenter);
  useEffect(() => { aktivtRef.current = aktivtKartPunkt; }, [aktivtKartPunkt]);
  useEffect(() => { onKlikkRef.current = onKartKlikk; }, [onKartKlikk]);
  useEffect(() => { punkterRef.current = punkter; startSenterRef.current = startSenter; });

  const tegnMarkorer = useCallback((liste: KartPunkt[]) => {
    const Lib = LRef.current;
    const lag = markorLagRef.current;
    if (!Lib || !lag) return;
    lag.clearLayers();
    for (const p of liste) {
      if (isNaN(p.lat) || isNaN(p.lng)) continue;
      Lib.marker([p.lat, p.lng], { icon: lagMarkorIkon(Lib, p.farge, String(p.nr)) }).addTo(lag);
    }
  }, []);

  useEffect(() => {
    if (!kartRef.current || mapRef.current) return;
    let avbrutt = false;

    async function initKart() {
      const Lmod = await import("leaflet");
      if (avbrutt || !kartRef.current) return;

      // Injiser Leaflet CSS hvis den ikke allerede finnes
      if (!document.querySelector("link[href*='leaflet']")) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }
      const Lib = (Lmod.default ?? Lmod) as typeof L_Type;
      LRef.current = Lib;

      const map = Lib.map(kartRef.current, { zoomControl: false });

      // Norge i Bilder (satellitt) som hovedlag
      const satellitt = Lib.tileLayer(
        "https://waapi.webatlas.no/maptiles/tiles/webatlas-orto-newup/wa_grid/{z}/{x}/{y}.jpeg?api_key=b8e36d51-119a-423b-b156-d744d54123d5",
        { attribution: "Norkart/Geovekst", maxZoom: 20 },
      );
      const osm = Lib.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        { attribution: "&copy; OSM", maxZoom: 19 },
      );
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

      markorLagRef.current = Lib.layerGroup().addTo(map);

      // Smart startsenter: (a) fit til eksisterende punkter → (b) byggeplass-geofence → (d) Norge
      const ip = punkterRef.current.filter((p) => !isNaN(p.lat) && !isNaN(p.lng));
      if (ip.length >= 1) {
        const bounds = Lib.latLngBounds(ip.map((p) => [p.lat, p.lng] as [number, number]));
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 18 });
        if (ip.length === 1) map.setView([ip[0]!.lat, ip[0]!.lng], 17);
      } else if (startSenterRef.current) {
        map.setView([startSenterRef.current.lat, startSenterRef.current.lng], 15);
      } else {
        map.setView([65, 13], 5);
      }

      map.on("click", (e: L_Type.LeafletMouseEvent) => {
        if (aktivtRef.current == null) return;
        onKlikkRef.current(e.latlng.lat, e.latlng.lng);
      });

      mapRef.current = map;
      setTimeout(() => map.invalidateSize(), 100);
      tegnMarkorer(punkterRef.current);
    }

    initKart();

    return () => {
      avbrutt = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markorLagRef.current = null;
      }
    };
    // Kun kjør ved mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tegn markører på nytt når punktene endres
  useEffect(() => {
    tegnMarkorer(punkter);
  }, [punkter, tegnMarkorer]);

  // Fly til koordinat (adressesøk-treff / eksternt senter-kommando)
  useEffect(() => {
    if (!flyTil || !mapRef.current) return;
    mapRef.current.flyTo([flyTil.lat, flyTil.lng], 17);
  }, [flyTil]);

  return (
    <div
      ref={kartRef}
      className="rounded border border-gray-200"
      style={{ height: 240, width: "100%" }}
    />
  );
}

export function GeoReferanseEditor({
  tegningId,
  tegning,
  onLagret,
  byggeplassId,
  startSenter,
}: GeoReferanseEditorProps) {
  const { t } = useTranslation();
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
  const [ekstraPunkter, setEkstraPunkter] = useState<Punkt[]>(
    eksisterende?.ekstraPunkter
      ? eksisterende.ekstraPunkter.map((ep) => ({
          pixel: ep.pixel,
          gps: { lat: String(ep.gps.lat), lng: String(ep.gps.lng) },
        }))
      : [],
  );
  const [aktivtPunkt, setAktivtPunkt] = useState<number | null>(null); // tegning-pixel-plassering
  const [aktivtKartPunkt, setAktivtKartPunkt] = useState<number | null>(null); // kart-gps-plassering
  const [lagreStatus, setLagreStatus] = useState<"idle" | "lagret" | "feil">("idle");
  const [limTekst, setLimTekst] = useState<Record<number, string>>({});
  const [visLimInn, setVisLimInn] = useState<Set<number>>(new Set());
  const [ekspandert, setEkspandert] = useState<Set<number>>(new Set());
  const [koordinatSystem, setKoordinatSystem] = useState<KoordinatSystem>("utm33");

  // Adressesøk (Kartverket-treffliste)
  const [adresse, setAdresse] = useState("");
  const [geokodMelding, setGeokodMelding] = useState<string | null>(null);
  const [adresseTreff, setAdresseTreff] = useState<AdresseTreff[]>([]);
  const [flyTil, setFlyTil] = useState<{ lat: number; lng: number } | null>(null);

  const flyTilTreff = (treff: AdresseTreff) => {
    setFlyTil({ lat: treff.lat, lng: treff.lng });
    setAdresseTreff([]);
    setGeokodMelding(null);
  };

  const geokodMutation = trpc.bygning.geokod.useMutation({
    onSuccess: (data: AdresseTreff[]) => {
      if (data.length === 0) {
        setAdresseTreff([]);
        setGeokodMelding(t("lokasjoner.geofence.geokodIngen"));
      } else if (data.length === 1) {
        flyTilTreff(data[0]!); // ett treff → fly direkte
      } else {
        setAdresseTreff(data); // flere → klikkbar treffliste
        setGeokodMelding(null);
      }
    },
    onError: (feil: { message: string }) => {
      setAdresseTreff([]);
      setGeokodMelding(feil.message);
    },
  });

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
      setEkstraPunkter([]);
      setAktivtPunkt(null);
      setAktivtKartPunkt(null);
      setEkspandert(new Set());
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
      const nr = aktivtPunkt;

      if (nr === 1) {
        setPunkt1((prev) => ({ pixel, gps: prev?.gps ?? { lat: "", lng: "" } }));
      } else if (nr === 2) {
        setPunkt2((prev) => ({ pixel, gps: prev?.gps ?? { lat: "", lng: "" } }));
      } else if (nr >= 3) {
        const idx = nr - 3;
        setEkstraPunkter((prev) => {
          const neste = [...prev];
          neste[idx] = { ...neste[idx]!, pixel, gps: neste[idx]?.gps ?? { lat: "", lng: "" } };
          return neste;
        });
      }
      // Etter pixel-plassering: hold raden ekspandert og la kartet sikte på samme punkt
      setEkspandert((prev) => new Set(prev).add(nr));
      setAktivtKartPunkt(nr);
      setAktivtPunkt(null);
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

  const gpsGyldig = (p: Punkt | null | undefined): p is Punkt =>
    !!p && !!p.gps.lat && !!p.gps.lng && !isNaN(Number(p.gps.lat)) && !isNaN(Number(p.gps.lng));

  const punkt1Gyldig = gpsGyldig(punkt1);
  const punkt2Gyldig = gpsGyldig(punkt2);

  const erIdentiske =
    punkt1Gyldig &&
    punkt2Gyldig &&
    Number(punkt1!.gps.lat) === Number(punkt2!.gps.lat) &&
    Number(punkt1!.gps.lng) === Number(punkt2!.gps.lng);

  // Innstramming (ordre pkt 6): begge hovedpunkter må ha pixel + gyldig gps + ikke være identiske.
  const punkt1Komplett = punkt1Gyldig && !!punkt1?.pixel;
  const punkt2Komplett = punkt2Gyldig && !!punkt2?.pixel;
  const kanLagre = punkt1Komplett && punkt2Komplett && !erIdentiske;

  function hentMinPosisjon(punktNr: number) {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const gps = { lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) };
        settPunktGps(punktNr, gps);
      },
      (err) => {
        console.warn("Geolocation feil:", err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  /** Oppdater GPS for et punkt (fra kart, min-posisjon eller innliming). */
  function settPunktGps(nr: number, gps: { lat: string; lng: string }) {
    if (nr === 1) {
      setPunkt1((p) => (p ? { ...p, gps } : p));
    } else if (nr === 2) {
      setPunkt2((p) => (p ? { ...p, gps } : p));
    } else {
      const idx = nr - 3;
      setEkstraPunkter((prev) => {
        const neste = [...prev];
        if (neste[idx]) neste[idx] = { ...neste[idx]!, gps };
        return neste;
      });
    }
  }

  /** Kartklikk setter GPS for det aktive kartpunktet + auto-kollaps (raden bekrefter ✓+koordinat). */
  const håndterKartKlikk = useCallback(
    (lat: number, lng: number) => {
      setAktivtKartPunkt((nr) => {
        if (nr == null) return nr;
        settPunktGps(nr, { lat: lat.toFixed(6), lng: lng.toFixed(6) });
        setEkspandert((prev) => {
          const neste = new Set(prev);
          neste.delete(nr); // auto-kollaps: brukeren ser ✓ + koordinat i raden
          return neste;
        });
        return null; // krev nytt chip-valg før neste kartklikk flytter noe
      });
    },
    // settPunktGps/setEkspandert er stabile via setters; ingen ekstra deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Valider ekstra punkter
  const gyldigeEkstraPunkter = ekstraPunkter.filter((ep) => gpsGyldig(ep));

  const totaltPunkter = (punkt1Gyldig ? 1 : 0) + (punkt2Gyldig ? 1 : 0) + gyldigeEkstraPunkter.length;

  // Markører til det felles kartet (kun gyldige gps-punkter)
  const kartPunkter = useMemo<KartPunkt[]>(() => {
    const liste: KartPunkt[] = [];
    if (punkt1Gyldig) liste.push({ nr: 1, lat: Number(punkt1!.gps.lat), lng: Number(punkt1!.gps.lng), farge: PUNKT1_FARGE });
    if (punkt2Gyldig) liste.push({ nr: 2, lat: Number(punkt2!.gps.lat), lng: Number(punkt2!.gps.lng), farge: PUNKT2_FARGE });
    ekstraPunkter.forEach((ep, idx) => {
      if (gpsGyldig(ep)) liste.push({ nr: idx + 3, lat: Number(ep.gps.lat), lng: Number(ep.gps.lng), farge: EKSTRA_FARGE });
    });
    return liste;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [punkt1, punkt2, ekstraPunkter, punkt1Gyldig, punkt2Gyldig]);

  // Beregn kalibreringskvalitet når 3+ punkter
  const kalibreringsFeil = totaltPunkter >= 3 && punkt1Gyldig && punkt2Gyldig
    ? (() => {
        try {
          const ref: GeoReferanse = {
            point1: { pixel: punkt1!.pixel, gps: { lat: Number(punkt1!.gps.lat), lng: Number(punkt1!.gps.lng) } },
            point2: { pixel: punkt2!.pixel, gps: { lat: Number(punkt2!.gps.lat), lng: Number(punkt2!.gps.lng) } },
            ekstraPunkter: gyldigeEkstraPunkter.map((ep) => ({
              pixel: ep.pixel,
              gps: { lat: Number(ep.gps.lat), lng: Number(ep.gps.lng) },
            })),
          };
          return beregnKalibreringsFeil(ref);
        } catch { return null; }
      })()
    : null;

  function handleLagre() {
    if (!punkt1 || !punkt2) return;

    const geoReference: GeoReferanse = {
      point1: {
        pixel: punkt1.pixel,
        gps: { lat: Number(punkt1.gps.lat), lng: Number(punkt1.gps.lng) },
      },
      point2: {
        pixel: punkt2.pixel,
        gps: { lat: Number(punkt2.gps.lat), lng: Number(punkt2.gps.lng) },
      },
    };

    if (gyldigeEkstraPunkter.length > 0) {
      geoReference.ekstraPunkter = gyldigeEkstraPunkter.map((ep) => ({
        pixel: ep.pixel,
        gps: { lat: Number(ep.gps.lat), lng: Number(ep.gps.lng) },
      }));
    }

    settGeoMutasjon.mutate({ drawingId: tegningId, geoReference });
  }

  function velgForTegning(nr: number) {
    // «Plasser»/«Flytt på tegningen»: neste tegningsklikk setter pixel. Ekspander raden.
    setAktivtPunkt(nr);
    setEkspandert((prev) => new Set(prev).add(nr));
  }

  function toggleEkspander(nr: number) {
    setEkspandert((prev) => {
      const neste = new Set(prev);
      if (neste.has(nr)) neste.delete(nr); else neste.add(nr);
      return neste;
    });
  }

  function toggleLimInn(nr: number) {
    setVisLimInn((prev) => {
      const neste = new Set(prev);
      if (neste.has(nr)) neste.delete(nr); else neste.add(nr);
      return neste;
    });
  }

  if (!tegning) {
    return (
      <div className="text-center text-gray-400">
        {t("georef.velgTegning")}
      </div>
    );
  }

  const filType = tegning.fileType ?? "";
  const erBilde = ["png", "jpg", "jpeg", "svg"].includes(filType);
  const erDwg = filType === "dwg";

  // Rekkefølge av eksisterende punkter (for chips + rader)
  const punktNumre: number[] = [];
  if (punkt1) punktNumre.push(1);
  if (punkt2) punktNumre.push(2);
  ekstraPunkter.forEach((_, idx) => punktNumre.push(idx + 3));

  function hentPunkt(nr: number): Punkt | null {
    if (nr === 1) return punkt1;
    if (nr === 2) return punkt2;
    return ekstraPunkter[nr - 3] ?? null;
  }

  function erGyldig(nr: number): boolean {
    return gpsGyldig(hentPunkt(nr));
  }

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
                  {t("georef.klikkForPunkt", { nr: aktivtPunkt })}
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
                title={modus === "hånd" ? t("georef.byttPeker") : t("georef.byttHaand")}
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
                title={t("georef.zoomUt")}
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
                title={t("georef.zoomInn")}
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
                    title={t("georef.nullstillVisning")}
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
                <p className="text-sm text-gray-500">{t("georef.dwgMaaKonverteres")}</p>
                <button
                  onClick={() => konverterMutation.mutate({ id: tegningId })}
                  disabled={konverterMutation.isPending}
                  className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
                >
                  {konverterMutation.isPending ? t("georef.starterKonvertering") : t("georef.konverterDwg")}
                </button>
                {konverterMutation.isSuccess && (
                  <p className="text-xs text-green-600">{t("georef.konverteringStartet")}</p>
                )}
              </div>
            ) : erBilde ? (
              <img
                src={`/api${tegning.fileUrl}`}
                alt={tegning.name}
                className="block w-full"
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

          {/* Markører på tegningen */}
          {punktNumre.map((nr) => {
            const p = hentPunkt(nr);
            if (!p?.pixel || !bildeRef.current) return null;
            const b = bildeRef.current;
            const lx = (p.pixel.x / 100) * b.offsetWidth;
            const ly = (p.pixel.y / 100) * b.offsetHeight;
            const vx = lx * view.zoom + view.panX;
            const vy = ly * view.zoom + view.panY;
            return (
              <div
                key={`markor-${nr}`}
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: vx, top: vy }}
              >
                <div
                  className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white shadow-md"
                  style={{ background: fargeForPunkt(nr) }}
                >
                  <span className="text-[10px] font-bold leading-none text-white">{nr}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Høyre: Georeferanse-panel */}
      <div className="flex w-96 flex-shrink-0 flex-col">
        {/* Fast topp: tittel + adressesøk + felles kart + punktvelger-chips */}
        <div className="flex flex-shrink-0 flex-col gap-2">
          <h3 className="text-sm font-semibold text-gray-900">{t("georef.tittel")}</h3>

          {/* Adressesøk (button-trigget, Kartverket-treffliste — ikke autocomplete) */}
          <div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input
                  label={t("lokasjoner.geofence.adresse")}
                  value={adresse}
                  onChange={(e) => {
                    setAdresse(e.target.value);
                    setGeokodMelding(null);
                    setAdresseTreff([]);
                  }}
                  placeholder={t("lokasjoner.geofence.adressePlaceholder")}
                  disabled={!byggeplassId}
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  byggeplassId &&
                  geokodMutation.mutate({ byggeplassId, adresse: adresse.trim() })
                }
                disabled={!byggeplassId || adresse.trim().length === 0 || geokodMutation.isPending}
              >
                <Search className="mr-1.5 h-4 w-4" />
                {geokodMutation.isPending ? t("lokasjoner.geofence.sokLaster") : t("lokasjoner.geofence.sok")}
              </Button>
            </div>
            {adresseTreff.length > 0 && (
              <ul className="mt-1 overflow-hidden rounded-md border border-gray-200">
                {adresseTreff.map((treff, i) => (
                  <li key={`${treff.label}-${i}`}>
                    <button
                      type="button"
                      onClick={() => flyTilTreff(treff)}
                      className="flex w-full items-center gap-2 border-b border-gray-100 px-2.5 py-1.5 text-left text-xs text-gray-700 last:border-b-0 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <MapPin className="h-3 w-3 flex-shrink-0 text-gray-400" />
                      <span className="truncate">{treff.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!byggeplassId && (
              <p className="mt-1 text-xs text-gray-400">{t("georef.adresseUtenByggeplass")}</p>
            )}
            {geokodMelding && (
              <p className="mt-1 text-xs text-sitedoc-error">{geokodMelding}</p>
            )}
            <p className="mt-1 text-xs text-gray-400">{t("georef.attribusjonKartverket")}</p>
          </div>

          {/* Ett felles kart */}
          <FellesKart
            punkter={kartPunkter}
            aktivtKartPunkt={aktivtKartPunkt}
            onKartKlikk={håndterKartKlikk}
            flyTil={flyTil}
            startSenter={startSenter ?? null}
          />

          {/* Punktvelger-chips: hvilket punkt kartklikket setter */}
          {punktNumre.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium text-gray-500">{t("georef.kartHjelpVelg")}</span>
              {punktNumre.map((nr) => (
                <button
                  key={`chip-${nr}`}
                  type="button"
                  onClick={() => setAktivtKartPunkt(aktivtKartPunkt === nr ? null : nr)}
                  className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors ${
                    aktivtKartPunkt === nr
                      ? "border-transparent bg-blue-600 text-white"
                      : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: aktivtKartPunkt === nr ? "#fff" : fargeForPunkt(nr) }}
                  />
                  {t("georef.punkt", { nr })}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-gray-400">{t("georef.kartHjelpIngen")}</p>
          )}
        </div>

        {/* Rullbar midtdel: punktrader */}
        <div className="mt-3 flex flex-1 flex-col gap-2 overflow-y-auto pr-0.5">
          {[1, 2].map((nr) => {
            const p = hentPunkt(nr);
            const gyldig = erGyldig(nr);
            const erEkspandert = ekspandert.has(nr);
            const farge = fargeForPunkt(nr);

            // Ikke plassert ennå → kompakt «Plasser»-knapp
            if (!p) {
              return (
                <div key={`rad-${nr}`} className="rounded-lg border border-gray-200 bg-white p-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ background: farge }}
                      >
                        {nr}
                      </span>
                      <span className="text-xs font-semibold text-gray-900">{t("georef.punkt", { nr })}</span>
                      <span className="text-[11px] text-gray-400">{t("georef.ikkeSatt")}</span>
                    </div>
                    <Button
                      size="sm"
                      variant={aktivtPunkt === nr ? "primary" : "secondary"}
                      onClick={() => velgForTegning(nr)}
                    >
                      <MapPin className="mr-1 h-3 w-3" />
                      {t("georef.plasser")}
                    </Button>
                  </div>
                  <p className="mt-1 text-[11px] text-gray-400">{t("georef.klikkTegning")}</p>
                </div>
              );
            }

            return (
              <PunktRad
                key={`rad-${nr}`}
                nr={nr}
                farge={farge}
                punkt={p}
                gyldig={gyldig}
                erEkspandert={erEkspandert}
                visLimInn={visLimInn.has(nr)}
                koordinatSystem={koordinatSystem}
                onKoordinatSystem={setKoordinatSystem}
                onToggleEkspander={() => toggleEkspander(nr)}
                onToggleLimInn={() => toggleLimInn(nr)}
                onFlyttPaaTegning={() => velgForTegning(nr)}
                aktivPaaTegning={aktivtPunkt === nr}
                onMinPosisjon={() => hentMinPosisjon(nr)}
                limTekst={limTekst[nr] ?? ""}
                onLimTekst={(v) => {
                  setLimTekst((prev) => ({ ...prev, [nr]: v }));
                  const resultat = parserKoordinater(v, koordinatSystem);
                  if (resultat) settPunktGps(nr, resultat);
                }}
                onEndreLat={(lat) => settPunktGps(nr, { lat, lng: p.gps.lng })}
                onEndreLng={(lng) => settPunktGps(nr, { lat: p.gps.lat, lng })}
                t={t}
              />
            );
          })}

          {/* Ekstra punkter */}
          {ekstraPunkter.map((ep, idx) => {
            const nr = idx + 3;
            return (
              <PunktRad
                key={`rad-${nr}`}
                nr={nr}
                farge={EKSTRA_FARGE}
                punkt={ep}
                gyldig={gpsGyldig(ep)}
                erEkspandert={ekspandert.has(nr)}
                visLimInn={visLimInn.has(nr)}
                koordinatSystem={koordinatSystem}
                onKoordinatSystem={setKoordinatSystem}
                onToggleEkspander={() => toggleEkspander(nr)}
                onToggleLimInn={() => toggleLimInn(nr)}
                onFlyttPaaTegning={() => velgForTegning(nr)}
                aktivPaaTegning={aktivtPunkt === nr}
                onMinPosisjon={() => hentMinPosisjon(nr)}
                onFjern={() => {
                  setEkstraPunkter((prev) => prev.filter((_, i) => i !== idx));
                  setEkspandert((prev) => { const n = new Set(prev); n.delete(nr); return n; });
                }}
                limTekst={limTekst[nr] ?? ""}
                onLimTekst={(v) => {
                  setLimTekst((prev) => ({ ...prev, [nr]: v }));
                  const resultat = parserKoordinater(v, koordinatSystem);
                  if (resultat) settPunktGps(nr, resultat);
                }}
                onEndreLat={(lat) => settPunktGps(nr, { lat, lng: ep.gps.lng })}
                onEndreLng={(lng) => settPunktGps(nr, { lat: ep.gps.lat, lng })}
                t={t}
              />
            );
          })}

          {/* Legg til punkt */}
          {punkt1Komplett && punkt2Komplett && (
            <button
              type="button"
              onClick={() =>
                setEkstraPunkter((prev) => [
                  ...prev,
                  { pixel: { x: 50, y: 50 }, gps: { lat: "", lng: "" } },
                ])
              }
              className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("georef.leggTilPunkt")}
            </button>
          )}
        </div>

        {/* Sticky footer: kvalitet + lagre + fjern (alltid synlig) */}
        <div className="mt-2 flex flex-shrink-0 flex-col gap-2 border-t border-gray-200 pt-2">
          {kalibreringsFeil && (
            <div className={`rounded-lg border p-2.5 ${
              kalibreringsFeil.gjennomsnittFeil < 2
                ? "border-green-200 bg-green-50"
                : kalibreringsFeil.gjennomsnittFeil < 5
                  ? "border-amber-200 bg-amber-50"
                  : "border-red-200 bg-red-50"
            }`}>
              <div className="flex items-center gap-1.5 text-xs font-medium">
                {kalibreringsFeil.gjennomsnittFeil < 2 ? (
                  <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                )}
                <span className={
                  kalibreringsFeil.gjennomsnittFeil < 2 ? "text-green-700" :
                  kalibreringsFeil.gjennomsnittFeil < 5 ? "text-amber-700" : "text-red-700"
                }>
                  {t("georef.kalibreringskvalitet", {
                    feil: kalibreringsFeil.gjennomsnittFeil < 0.1 ? "< 0.1" : kalibreringsFeil.gjennomsnittFeil.toFixed(1),
                  })}
                </span>
              </div>
              <p className="mt-1 text-[10px] text-gray-500">
                {t("georef.maksAvvik", { feil: kalibreringsFeil.maksFeil.toFixed(1) })}
                {totaltPunkter >= 3 && ` ${t("georef.affinTransform")}`}
              </p>
            </div>
          )}

          {lagreStatus === "lagret" && (
            <div className="flex items-center gap-1.5 rounded-md bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
              <Check className="h-4 w-4" />
              {t("georef.lagret")}
            </div>
          )}
          {lagreStatus === "feil" && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {t("georef.lagreFeil")}
            </div>
          )}

          {erIdentiske && (
            <div className="rounded-md bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
              {t("georef.identiske")}
            </div>
          )}

          <Button
            onClick={handleLagre}
            disabled={!kanLagre || settGeoMutasjon.isPending}
            className="w-full"
          >
            <Check className="mr-1.5 h-4 w-4" />
            {settGeoMutasjon.isPending
              ? t("georef.lagrer")
              : !kanLagre
                ? t("georef.trengerToPunkter")
                : totaltPunkter >= 3
                  ? t("georef.lagreKalibreringN", { n: totaltPunkter })
                  : t("georef.lagreKalibrering")}
          </Button>

          {eksisterende && (
            <Button
              variant="danger"
              onClick={() => fjernGeoMutasjon.mutate({ drawingId: tegningId })}
              disabled={fjernGeoMutasjon.isPending}
              className="w-full"
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              {fjernGeoMutasjon.isPending ? t("georef.fjerner") : t("georef.fjernKalibrering")}
            </Button>
          )}

          <p className="text-[10px] text-gray-400">{t("georef.hjelpetekst")}</p>
        </div>
      </div>
    </div>
  );
}

/** Én punktrad — kollapset (badge + koordinat + ✓) eller ekspandert (handlinger). */
function PunktRad({
  nr,
  farge,
  punkt,
  gyldig,
  erEkspandert,
  visLimInn,
  koordinatSystem,
  onKoordinatSystem,
  onToggleEkspander,
  onToggleLimInn,
  onFlyttPaaTegning,
  aktivPaaTegning,
  onMinPosisjon,
  onFjern,
  limTekst,
  onLimTekst,
  onEndreLat,
  onEndreLng,
  t,
}: {
  nr: number;
  farge: string;
  punkt: Punkt;
  gyldig: boolean;
  erEkspandert: boolean;
  visLimInn: boolean;
  koordinatSystem: KoordinatSystem;
  onKoordinatSystem: (s: KoordinatSystem) => void;
  onToggleEkspander: () => void;
  onToggleLimInn: () => void;
  onFlyttPaaTegning: () => void;
  aktivPaaTegning: boolean;
  onMinPosisjon: () => void;
  onFjern?: () => void;
  limTekst: string;
  onLimTekst: (v: string) => void;
  onEndreLat: (v: string) => void;
  onEndreLng: (v: string) => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const koordinatTekst = gyldig
    ? `${Number(punkt.gps.lat).toFixed(5)}, ${Number(punkt.gps.lng).toFixed(5)}`
    : t("georef.ikkeSatt");

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      {/* Radhode — klikkbart for kollaps/ekspander. Viser ✓ + koordinat som bekreftelse. */}
      <button
        type="button"
        onClick={onToggleEkspander}
        className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left"
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ background: farge }}
          >
            {nr}
          </span>
          <span className="flex-shrink-0 text-xs font-semibold text-gray-900">{t("georef.punkt", { nr })}</span>
          <span className={`truncate font-mono text-[11px] ${gyldig ? "text-gray-600" : "text-gray-400"}`}>
            {koordinatTekst}
          </span>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          {gyldig && <Check className="h-3.5 w-3.5 text-green-600" />}
          {erEkspandert ? (
            <ChevronUp className="h-3.5 w-3.5 text-gray-400" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
          )}
        </div>
      </button>

      {erEkspandert && (
        <div className="flex flex-col gap-1.5 border-t border-gray-100 px-2.5 py-2">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onFlyttPaaTegning}
              className={`flex items-center gap-1 text-xs font-medium ${
                aktivPaaTegning ? "text-amber-600" : "text-blue-600 hover:text-blue-800"
              }`}
            >
              <MapPin className="h-3 w-3" />
              {t("georef.flyttPaaTegning")}
            </button>
            <button
              type="button"
              onClick={onMinPosisjon}
              className="flex items-center gap-1 text-xs font-medium text-green-600 hover:text-green-800"
              title={t("georef.minPosisjonTittel")}
            >
              <LocateFixed className="h-3 w-3" />
              {t("georef.minPosisjon")}
            </button>
            {onFjern && (
              <button
                type="button"
                onClick={onFjern}
                className="ml-auto flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-red-500"
                title={t("georef.fjernPunkt")}
              >
                <Trash2 className="h-3 w-3" />
                {t("georef.fjernPunkt")}
              </button>
            )}
          </div>

          {/* Lim inn koordinater (m/ koordinatsystem-velger) */}
          <button
            type="button"
            onClick={onToggleLimInn}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
          >
            {t("georef.limInn")}
            {visLimInn ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          {visLimInn && (
            <div className="flex flex-col gap-1.5 rounded border border-gray-100 bg-gray-50 p-2">
              <label className="block text-[10px] font-medium text-gray-500">
                {t("georef.koordinatsystem")}
              </label>
              <select
                value={koordinatSystem}
                onChange={(e) => onKoordinatSystem(e.target.value as KoordinatSystem)}
                className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700"
              >
                {KOORDINAT_SYSTEMER.map((sys) => (
                  <option key={sys.verdi} value={sys.verdi}>
                    {sys.label}
                  </option>
                ))}
              </select>
              <Input
                label=""
                value={limTekst}
                onChange={(e) => onLimTekst(e.target.value)}
                placeholder={koordinatSystem === "wgs84" ? "F.eks. 69.659, 18.963" : "F.eks. Nord: 7731109 Øst: 652332"}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-1.5">
            <Input
              label={t("lokasjoner.geofence.lat")}
              value={punkt.gps.lat}
              onChange={(e) => onEndreLat(e.target.value)}
              placeholder="f.eks. 59.911"
            />
            <Input
              label={t("lokasjoner.geofence.lng")}
              value={punkt.gps.lng}
              onChange={(e) => onEndreLng(e.target.value)}
              placeholder="f.eks. 10.750"
            />
          </div>
        </div>
      )}
    </div>
  );
}
