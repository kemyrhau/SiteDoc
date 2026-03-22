"use client";

import { useEffect, useRef, useState, useCallback } from "react";
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
  onVelgBilder?: (valgte: number[]) => void;
  velgModus?: boolean;
  valgteBilder?: Set<string>;
}

const kameraIkon = L.divIcon({
  className: "",
  html: `<div style="background:#1e40af;color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:14px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);cursor:pointer;">📷</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -16],
});

const valgtIkon = L.divIcon({
  className: "",
  html: `<div style="background:#10b981;color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:14px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);cursor:pointer;">✓</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -16],
});

export function BildeKart({ bilder, onKlikkBilde, onVelgBilder, velgModus, valgteBilder }: BildeKartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const rectRef = useRef<L.Rectangle | null>(null);
  const [erVelger, setErVelger] = useState(false);
  const dragStartRef = useRef<L.LatLng | null>(null);

  // Oppdater markør-ikoner basert på valgte bilder
  useEffect(() => {
    if (!valgteBilder) return;
    for (const [bildeId, marker] of markersRef.current) {
      marker.setIcon(valgteBilder.has(bildeId) ? valgtIkon : kameraIkon);
    }
  }, [valgteBilder]);

  useEffect(() => {
    if (!containerRef.current || bilder.length === 0) return;

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
    for (const marker of markersRef.current.values()) {
      map.removeLayer(marker);
    }
    markersRef.current.clear();

    // Legg til markører
    const bounds = L.latLngBounds([]);
    bilder.forEach((bilde, index) => {
      if (bilde.gpsLat == null || bilde.gpsLng == null) return;
      const pos = L.latLng(bilde.gpsLat, bilde.gpsLng);
      bounds.extend(pos);

      const erValgt = valgteBilder?.has(bilde.id) ?? false;
      const dato = new Date(bilde.createdAt).toLocaleDateString("nb-NO");
      const marker = L.marker(pos, { icon: erValgt ? valgtIkon : kameraIkon })
        .addTo(map)
        .bindPopup(
          `<div style="min-width:120px">
            <img src="/api${bilde.fileUrl}" style="width:120px;height:96px;object-fit:cover;border-radius:4px;cursor:pointer;" onclick="window.__bildeKartKlikk(${index})" />
            <div style="margin-top:4px;font-size:11px;color:#555">${dato}</div>
            <div style="font-size:11px;color:#333;font-weight:500">${bilde.parentLabel}</div>
          </div>`,
          { closeButton: false },
        );

      marker.on("click", () => {
        if (velgModus && onVelgBilder) {
          // I velgemodus: toggle valgt-status for dette bildet
          const nyeValgte = new Set(valgteBilder);
          if (nyeValgte.has(bilde.id)) nyeValgte.delete(bilde.id);
          else nyeValgte.add(bilde.id);
          const indekser = bilder
            .map((b, i) => nyeValgte.has(b.id) ? i : -1)
            .filter((i) => i >= 0);
          onVelgBilder(indekser);
        } else {
          marker.openPopup();
        }
      });

      markersRef.current.set(bilde.id, marker);
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
  }, [bilder, onKlikkBilde, velgModus]); // eslint-disable-line

  // Rektangelvalg i velgemodus
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !velgModus || !onVelgBilder) return;

    // Deaktiver dra på kartet ved shift+dra
    function handleMouseDown(e: L.LeafletMouseEvent) {
      if (!e.originalEvent.shiftKey) return;
      map!.dragging.disable();
      dragStartRef.current = e.latlng;
      setErVelger(true);
    }

    function handleMouseMove(e: L.LeafletMouseEvent) {
      if (!dragStartRef.current) return;
      if (rectRef.current) map!.removeLayer(rectRef.current);
      rectRef.current = L.rectangle(
        L.latLngBounds(dragStartRef.current, e.latlng),
        { color: "#3b82f6", weight: 2, fillOpacity: 0.15 },
      ).addTo(map!);
    }

    function handleMouseUp(e: L.LeafletMouseEvent) {
      if (!dragStartRef.current) return;
      const bounds = L.latLngBounds(dragStartRef.current, e.latlng);
      dragStartRef.current = null;
      setErVelger(false);
      map!.dragging.enable();

      // Finn bilder innenfor rektangelet
      const indekser: number[] = [];
      bilder.forEach((b, i) => {
        if (b.gpsLat == null || b.gpsLng == null) return;
        if (bounds.contains(L.latLng(b.gpsLat, b.gpsLng))) indekser.push(i);
      });
      if (indekser.length > 0 && onVelgBilder) onVelgBilder(indekser);

      // Fjern rektangel etter kort tid
      setTimeout(() => {
        if (rectRef.current) { map!.removeLayer(rectRef.current); rectRef.current = null; }
      }, 500);
    }

    map.on("mousedown", handleMouseDown);
    map.on("mousemove", handleMouseMove);
    map.on("mouseup", handleMouseUp);

    return () => {
      map.off("mousedown", handleMouseDown);
      map.off("mousemove", handleMouseMove);
      map.off("mouseup", handleMouseUp);
      map.dragging.enable();
      if (rectRef.current) { map.removeLayer(rectRef.current); rectRef.current = null; }
    };
  }, [velgModus, bilder, onVelgBilder]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {velgModus && (
        <div className="absolute bottom-3 left-1/2 z-[1000] -translate-x-1/2 rounded-lg bg-white/90 px-3 py-1.5 text-xs text-gray-600 shadow">
          Klikk markør for å velge/fjerne · Shift+dra for områdevalg
        </div>
      )}
    </div>
  );
}
