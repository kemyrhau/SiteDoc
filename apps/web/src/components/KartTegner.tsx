"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";

/*
 * V17-B — karttegner for byggeplass-soner (polygon + linje).
 *
 * Søster av `KartVelger` (samme rå-Leaflet-mønster, IKKE react-leaflet — det krever
 * React 19, vi har 18). Tegneverktøyet er `@geoman-io/leaflet-geoman-free` (MIT,
 * Kenneth-godkjent 2026-10-04). Komponenten:
 *  - viser byggeplassens origo (reise-anker, B2) som en flyttbar markør,
 *  - viser eksisterende soner som polygoner (lesevisning),
 *  - lar brukeren tegne ÉN polygon eller ÉN linje om gangen (styrt av `tegneModus`),
 *    og rapporterer punktene i lat/lng. Selve laget fjernes straks — sannheten er
 *    serverens `geo_polygon`, re-rendret fra `soner`.
 */

type GpsPunkt = { lat: number; lng: number };

const markorIkon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface KartTegnerProps {
  origo: GpsPunkt | null;
  soner: { id: string; navn: string; punkter: GpsPunkt[] }[];
  /** Aktiv tegnemodus (styrt av foreldrene). null = ikke tegn. */
  tegneModus: "polygon" | "linje" | null;
  onTegnetPolygon: (punkter: GpsPunkt[]) => void;
  onTegnetLinje: (punkter: GpsPunkt[]) => void;
  onFlyttOrigo: (lat: number, lng: number) => void;
  disabled?: boolean;
  hoyde?: string;
}

export function KartTegner({
  origo,
  soner,
  tegneModus,
  onTegnetPolygon,
  onTegnetLinje,
  onFlyttOrigo,
  disabled = false,
  hoyde = "320px",
}: KartTegnerProps) {
  const kartRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const origoRef = useRef<L.Marker | null>(null);
  const sonerLagRef = useRef<L.LayerGroup | null>(null);
  // Siste callbacks tilgjengelig for pm:create-handleren (registreres én gang).
  const cbRef = useRef({ onTegnetPolygon, onTegnetLinje });
  cbRef.current = { onTegnetPolygon, onTegnetLinje };

  const defaultSenter: [number, number] = origo
    ? [origo.lat, origo.lng]
    : soner[0]?.punkter[0]
      ? [soner[0]!.punkter[0]!.lat, soner[0]!.punkter[0]!.lng]
      : [59.91, 10.75]; // Oslo
  const zoom = origo || soner.length > 0 ? 15 : 5;

  // Init én gang.
  useEffect(() => {
    if (!kartRef.current || mapRef.current) return;
    const map = L.map(kartRef.current).setView(defaultSenter, zoom);
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

    sonerLagRef.current = L.layerGroup().addTo(map);

    // Geoman: skjul standard-verktøylinjen (vi styrer draw via `tegneModus`-prop).
    map.pm.addControls({
      position: "topleft",
      drawMarker: false,
      drawCircle: false,
      drawCircleMarker: false,
      drawRectangle: false,
      drawPolygon: false,
      drawPolyline: false,
      drawText: false,
      editMode: false,
      dragMode: false,
      cutPolygon: false,
      removalMode: false,
      rotateMode: false,
    });

    // Når en figur er tegnet: les punktene, rapporter, fjern laget (serveren eier sannheten).
    map.on("pm:create", (e: { shape: string; layer: L.Layer }) => {
      const layer = e.layer as L.Polygon | L.Polyline;
      const latlngs = layer.getLatLngs();
      if (e.shape === "Polygon") {
        const ring = (latlngs[0] as L.LatLng[]).map((p) => ({ lat: p.lat, lng: p.lng }));
        cbRef.current.onTegnetPolygon(ring);
      } else if (e.shape === "Line") {
        const linje = (latlngs as L.LatLng[]).map((p) => ({ lat: p.lat, lng: p.lng }));
        cbRef.current.onTegnetLinje(linje);
      }
      map.removeLayer(layer);
    });

    setTimeout(() => map.invalidateSize(), 100);
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(kartRef.current);

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      origoRef.current = null;
      sonerLagRef.current = null;
    };
    // eslint-disable-next-line
  }, []);

  // Tegn/oppdater origo-markøren.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (origo) {
      if (origoRef.current) {
        origoRef.current.setLatLng([origo.lat, origo.lng]);
      } else {
        origoRef.current = L.marker([origo.lat, origo.lng], {
          icon: markorIkon,
          draggable: !disabled,
          title: "Origo (reise-anker)",
        }).addTo(map);
        if (!disabled) {
          origoRef.current.on("dragend", () => {
            const pos = origoRef.current!.getLatLng();
            onFlyttOrigo(pos.lat, pos.lng);
          });
        }
      }
    } else if (origoRef.current) {
      origoRef.current.remove();
      origoRef.current = null;
    }
    // eslint-disable-next-line
  }, [origo?.lat, origo?.lng, disabled]);

  // Tegn eksisterende soner (lesevisning) på nytt når settet endres.
  useEffect(() => {
    const lag = sonerLagRef.current;
    if (!lag) return;
    lag.clearLayers();
    for (const sone of soner) {
      if (sone.punkter.length < 3) continue;
      L.polygon(
        sone.punkter.map((p) => [p.lat, p.lng] as [number, number]),
        { color: "#1e40af", fillColor: "#3b82f6", fillOpacity: 0.15, weight: 2 },
      )
        .bindTooltip(sone.navn, { sticky: true })
        .addTo(lag);
    }
  }, [soner]);

  // Start/stopp tegning når `tegneModus` endres.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.pm.disableDraw();
    if (disabled) return;
    if (tegneModus === "polygon") map.pm.enableDraw("Polygon", { snappable: true });
    else if (tegneModus === "linje") map.pm.enableDraw("Line", { snappable: true });
  }, [tegneModus, disabled]);

  return (
    <div
      ref={kartRef}
      style={{ height: hoyde, width: "100%" }}
      className="rounded-lg border border-gray-300"
    />
  );
}
