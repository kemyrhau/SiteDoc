"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default icon paths (mangler i webpack/next.js)
const markorIkon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface KartVelgerProps {
  latitude: number | null;
  longitude: number | null;
  onVelgPosisjon: (lat: number, lng: number) => void;
  disabled?: boolean;
  hoyde?: string;
  /** Valgfri geofence-radius i meter — tegner en sirkel rundt markøren. */
  radiusM?: number | null;
}

export function KartVelger({
  latitude,
  longitude,
  onVelgPosisjon,
  disabled = false,
  hoyde = "300px",
  radiusM,
}: KartVelgerProps) {
  const kartRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markorRef = useRef<L.Marker | null>(null);
  const sirkelRef = useRef<L.Circle | null>(null);
  // Siste radius tilgjengelig for klikk/dra-handlere som registreres én gang.
  const radiusRef = useRef<number | null | undefined>(radiusM);
  radiusRef.current = radiusM;

  // Standard: Oslo
  const defaultLat = 59.91;
  const defaultLng = 10.75;

  const harKoordinater = latitude != null && longitude != null;
  const senterLat = harKoordinater ? latitude : defaultLat;
  const senterLng = harKoordinater ? longitude : defaultLng;
  const zoom = harKoordinater ? 15 : 5;

  // Tegn/flytt/fjern radius-sirkelen. Trygt å kalle uten kart (no-op).
  function syncSirkel(lat: number, lng: number) {
    const map = mapRef.current;
    if (!map) return;
    const r = radiusRef.current;
    if (r != null && r > 0) {
      if (sirkelRef.current) {
        sirkelRef.current.setLatLng([lat, lng]);
        sirkelRef.current.setRadius(r);
      } else {
        sirkelRef.current = L.circle([lat, lng], {
          radius: r,
          color: "#1e40af",
          fillColor: "#3b82f6",
          fillOpacity: 0.12,
          weight: 1,
        }).addTo(map);
      }
    } else if (sirkelRef.current) {
      sirkelRef.current.remove();
      sirkelRef.current = null;
    }
  }

  useEffect(() => {
    if (!kartRef.current || mapRef.current) return;

    const map = L.map(kartRef.current).setView([senterLat, senterLng], zoom);
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

    // Plasser markør hvis koordinater finnes
    if (harKoordinater) {
      markorRef.current = L.marker([latitude, longitude], {
        icon: markorIkon,
        draggable: !disabled,
      }).addTo(map);
      syncSirkel(latitude, longitude);

      if (!disabled) {
        markorRef.current.on("dragend", () => {
          const pos = markorRef.current!.getLatLng();
          syncSirkel(pos.lat, pos.lng);
          onVelgPosisjon(pos.lat, pos.lng);
        });
      }
    }

    // Klikk for å plassere/flytte markør
    if (!disabled) {
      map.on("click", (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;

        if (markorRef.current) {
          markorRef.current.setLatLng([lat, lng]);
        } else {
          markorRef.current = L.marker([lat, lng], {
            icon: markorIkon,
            draggable: true,
          }).addTo(map);

          markorRef.current.on("dragend", () => {
            const pos = markorRef.current!.getLatLng();
            syncSirkel(pos.lat, pos.lng);
            onVelgPosisjon(pos.lat, pos.lng);
          });
        }

        syncSirkel(lat, lng);
        onVelgPosisjon(lat, lng);
      });
    }

    // Fix Leaflet size calc etter mount (fallback).
    setTimeout(() => map.invalidateSize(), 100);

    // Kartet ligger ofte i en native <dialog>-Modal som er display:none ved
    // mount → L.map() initialiseres med 0×0-container, og timeout-en over
    // fyrer mens dialogen fortsatt er skjult. Når modalen åpnes går
    // containeren 0 → faktisk høyde; ResizeObserver fanger det og reberegner
    // fliser. Fikser alle modal-hostede kart-bruk (rotårsak, ikke bare geofence).
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(kartRef.current);

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      markorRef.current = null;
      sirkelRef.current = null;
    };
    // eslint-disable-next-line
  }, []);

  // Oppdater markør + sirkel når koordinater/radius endres eksternt
  useEffect(() => {
    if (!mapRef.current) return;

    if (harKoordinater) {
      if (markorRef.current) {
        markorRef.current.setLatLng([latitude, longitude]);
      } else {
        markorRef.current = L.marker([latitude, longitude], {
          icon: markorIkon,
          draggable: !disabled,
        }).addTo(mapRef.current);
      }
      syncSirkel(latitude, longitude);
      mapRef.current.setView([latitude, longitude], 15);
    } else {
      if (markorRef.current) {
        markorRef.current.remove();
        markorRef.current = null;
      }
      if (sirkelRef.current) {
        sirkelRef.current.remove();
        sirkelRef.current = null;
      }
      mapRef.current.setView([defaultLat, defaultLng], 5);
    }
    // eslint-disable-next-line
  }, [latitude, longitude, harKoordinater, disabled, radiusM]);

  return (
    <div
      ref={kartRef}
      style={{ height: hoyde, width: "100%" }}
      className="rounded-lg border border-gray-300"
    />
  );
}
