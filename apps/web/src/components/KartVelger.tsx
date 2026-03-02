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
}

export function KartVelger({
  latitude,
  longitude,
  onVelgPosisjon,
  disabled = false,
  hoyde = "300px",
}: KartVelgerProps) {
  const kartRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markorRef = useRef<L.Marker | null>(null);

  // Standard: Oslo
  const defaultLat = 59.91;
  const defaultLng = 10.75;

  const harKoordinater = latitude != null && longitude != null;
  const senterLat = harKoordinater ? latitude : defaultLat;
  const senterLng = harKoordinater ? longitude : defaultLng;
  const zoom = harKoordinater ? 15 : 5;

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

      if (!disabled) {
        markorRef.current.on("dragend", () => {
          const pos = markorRef.current!.getLatLng();
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
            onVelgPosisjon(pos.lat, pos.lng);
          });
        }

        onVelgPosisjon(lat, lng);
      });
    }

    // Fix Leaflet size calc etter mount
    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      map.remove();
      mapRef.current = null;
      markorRef.current = null;
    };
    // eslint-disable-next-line
  }, []);

  // Oppdater markør når koordinater endres eksternt
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
      mapRef.current.setView([latitude, longitude], 15);
    } else if (markorRef.current) {
      markorRef.current.remove();
      markorRef.current = null;
      mapRef.current.setView([defaultLat, defaultLng], 5);
    }
  }, [latitude, longitude, harKoordinater, disabled]);

  return (
    <div
      ref={kartRef}
      style={{ height: hoyde, width: "100%" }}
      className="rounded-lg border border-gray-300"
    />
  );
}
