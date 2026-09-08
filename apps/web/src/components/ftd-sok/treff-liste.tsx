"use client";

import { FileText, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  if (treff.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-gray-400">
        {t("ftdSok.ingenTreff")}
      </div>
    );
  }

  function åpneOriginal(tr: Treff) {
    if (!tr.fileUrl) return;
    const url = tr.fileUrl.startsWith("/api") ? tr.fileUrl : `/api${tr.fileUrl}`;
    window.open(url, "_blank");
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500">{t("ftdSok.antallTreff", { antall: treff.length })}</div>
      {treff.map((tr) => (
        <button
          key={tr.id}
          onClick={() => onVelgTreff(tr)}
          onDoubleClick={() => åpneOriginal(tr)}
          className={`group w-full rounded border p-3 text-left transition-colors hover:bg-gray-50 ${
            valgtId === tr.id ? "border-sitedoc-primary bg-blue-50" : ""
          }`}
        >
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-gray-400" />
            <span className="flex-1 text-sm font-medium">
              {tr.filename}
            </span>
            {tr.pageNumber && (
              <span className="text-xs text-gray-400">
                {t("ftdSok.side", { side: tr.pageNumber })}
              </span>
            )}
            <ExternalLink className="h-3.5 w-3.5 text-gray-300 opacity-0 group-hover:opacity-100" />
          </div>
          {tr.sectionTitle && (
            <div className="mt-0.5 text-xs text-gray-500">
              {tr.sectionTitle}
            </div>
          )}
          <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-600">
            {tr.chunkText.slice(0, 200)}
            {tr.chunkText.length > 200 ? "..." : ""}
          </div>
        </button>
      ))}
    </div>
  );
}
