"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface BildeKartBilde {
  id: string;
  fileUrl: string;
  gpsLat: number | null;
  gpsLng: number | null;
  createdAt: string;
  parentLabel: string;
}

interface BildeKartProps {
  bilder: BildeKartBilde[];
  onKlikkBilde: (index: number) => void;
}

const kameraIkon = L.divIcon({
  className: "",
  html: `<div style="background:#1e40af;color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:14px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);cursor:pointer;">📷</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -16],
});

export function BildeKart({ bilder, onKlikkBilde }: BildeKartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || bilder.length === 0) return;

    // Opprett kart hvis det ikke finnes
    if (!mapRef.current) {
      mapRef.current = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(mapRef.current);
    }

    const map = mapRef.current;

    // Fjern gamle markører
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) map.removeLayer(layer);
    });

    // Legg til markører
    const bounds = L.latLngBounds([]);
    bilder.forEach((bilde, index) => {
      if (bilde.gpsLat == null || bilde.gpsLng == null) return;
      const pos = L.latLng(bilde.gpsLat, bilde.gpsLng);
      bounds.extend(pos);

      const dato = new Date(bilde.createdAt).toLocaleDateString("nb-NO");
      const marker = L.marker(pos, { icon: kameraIkon })
        .addTo(map)
        .bindPopup(
          `<div style="min-width:120px">
            <img src="/api${bilde.fileUrl}" style="width:120px;height:96px;object-fit:cover;border-radius:4px;cursor:pointer;" onclick="window.__bildeKartKlikk(${index})" />
            <div style="margin-top:4px;font-size:11px;color:#555">${dato}</div>
            <div style="font-size:11px;color:#333;font-weight:500">${bilde.parentLabel}</div>
          </div>`,
          { closeButton: false },
        );

      marker.on("click", () => marker.openPopup());
    });

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
    }

    // Global callback for popup-klikk
    (window as unknown as Record<string, unknown>).__bildeKartKlikk = (index: number) => {
      onKlikkBilde(index);
    };

    return () => {
      delete (window as unknown as Record<string, unknown>).__bildeKartKlikk;
    };
  }, [bilder, onKlikkBilde]);

  // Cleanup kart ved unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return <div ref={containerRef} className="h-full w-full" />;
}
