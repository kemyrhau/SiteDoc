"use client";

import { useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, MapPin, Calendar, FileText } from "lucide-react";
import Link from "next/link";

export interface LightboxBilde {
  id: string;
  fileUrl: string;
  fileName: string;
  createdAt: string;
  gpsLat: number | null;
  gpsLng: number | null;
  parentType: "sjekkliste" | "oppgave";
  parentId: string;
  parentLabel: string;
  prosjektId: string;
}

interface BildeLightboxProps {
  bilder: LightboxBilde[];
  aktivIndex: number;
  onLukk: () => void;
  onEndreIndex: (index: number) => void;
}

export function BildeLightbox({ bilder, aktivIndex, onLukk, onEndreIndex }: BildeLightboxProps) {
  const bilde = bilder[aktivIndex];

  const gåForrige = useCallback(() => {
    if (aktivIndex > 0) onEndreIndex(aktivIndex - 1);
  }, [aktivIndex, onEndreIndex]);

  const gåNeste = useCallback(() => {
    if (aktivIndex < bilder.length - 1) onEndreIndex(aktivIndex + 1);
  }, [aktivIndex, bilder.length, onEndreIndex]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onLukk();
      if (e.key === "ArrowLeft") gåForrige();
      if (e.key === "ArrowRight") gåNeste();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onLukk, gåForrige, gåNeste]);

  if (!bilde) return null;

  const parentUrl = bilde.parentType === "sjekkliste"
    ? `/dashbord/${bilde.prosjektId}/sjekklister?sjekkliste=${bilde.parentId}`
    : `/dashbord/${bilde.prosjektId}/oppgaver?oppgave=${bilde.parentId}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onLukk}
    >
      {/* Lukk-knapp */}
      <button
        onClick={onLukk}
        className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Navigeringsknapper */}
      {aktivIndex > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); gåForrige(); }}
          className="absolute left-4 z-10 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      {aktivIndex < bilder.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); gåNeste(); }}
          className="absolute right-4 z-10 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* Bilde */}
      <div
        className="flex max-h-[85vh] max-w-[90vw] flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={`/api${bilde.fileUrl}`}
          alt={bilde.fileName}
          className="max-h-[75vh] max-w-full object-contain"
          crossOrigin="anonymous"
        />

        {/* Metadata */}
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-white/70">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {new Date(bilde.createdAt).toLocaleDateString("nb-NO")}
          </span>
          <span className="text-white/40">{bilde.fileName}</span>
          {bilde.gpsLat != null && bilde.gpsLng != null && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {bilde.gpsLat.toFixed(5)}, {bilde.gpsLng.toFixed(5)}
            </span>
          )}
          <Link
            href={parentUrl}
            className="flex items-center gap-1.5 text-blue-300 hover:text-blue-200"
            onClick={(e) => e.stopPropagation()}
          >
            <FileText className="h-3.5 w-3.5" />
            {bilde.parentLabel}
          </Link>
          <span className="text-white/40">
            {aktivIndex + 1} / {bilder.length}
          </span>
        </div>
      </div>
    </div>
  );
}
