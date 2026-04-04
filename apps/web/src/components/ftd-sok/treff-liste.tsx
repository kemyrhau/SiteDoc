"use client";

import { FileText, ExternalLink } from "lucide-react";

interface Treff {
  id: string;
  documentId: string;
  chunkText: string;
  pageNumber: number | null;
  sectionTitle: string | null;
  filename: string;
  fileUrl: string | null;
  docType: string | null;
  folderId: string | null;
  [key: string]: unknown;
}

interface TreffListeProps {
  treff: Treff[];
  onVelgTreff: (treff: Treff) => void;
  valgtId: string | null;
}

export function TreffListe({ treff, onVelgTreff, valgtId }: TreffListeProps) {
  if (treff.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-gray-400">
        Ingen treff.
      </div>
    );
  }

  function åpneOriginal(t: Treff) {
    if (!t.fileUrl) return;
    const url = t.fileUrl.startsWith("/api") ? t.fileUrl : `/api${t.fileUrl}`;
    window.open(url, "_blank");
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500">{treff.length} treff</div>
      {treff.map((t) => (
        <button
          key={t.id}
          onClick={() => onVelgTreff(t)}
          onDoubleClick={() => åpneOriginal(t)}
          className={`group w-full rounded border p-3 text-left transition-colors hover:bg-gray-50 ${
            valgtId === t.id ? "border-sitedoc-primary bg-blue-50" : ""
          }`}
        >
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-gray-400" />
            <span className="flex-1 text-sm font-medium">
              {t.filename}
            </span>
            {t.pageNumber && (
              <span className="text-xs text-gray-400">
                side {t.pageNumber}
              </span>
            )}
            <ExternalLink className="h-3.5 w-3.5 text-gray-300 opacity-0 group-hover:opacity-100" />
          </div>
          {t.sectionTitle && (
            <div className="mt-0.5 text-xs text-gray-500">
              {t.sectionTitle}
            </div>
          )}
          <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-600">
            {t.chunkText.slice(0, 200)}
            {t.chunkText.length > 200 ? "..." : ""}
          </div>
        </button>
      ))}
    </div>
  );
}
