"use client";

import { useState } from "react";
import { hentStatusHandlinger } from "@sitedoc/shared";

// Map Tailwind mobile-klasser til web-varianter
const FARGE_MAP: Record<string, { bg: string; hover: string }> = {
  "bg-blue-600": { bg: "bg-blue-600", hover: "hover:bg-blue-700" },
  "bg-red-600": { bg: "bg-red-600", hover: "hover:bg-red-700" },
  "bg-amber-500": { bg: "bg-amber-500", hover: "hover:bg-amber-600" },
  "bg-purple-600": { bg: "bg-purple-600", hover: "hover:bg-purple-700" },
  "bg-green-600": { bg: "bg-green-600", hover: "hover:bg-green-700" },
  "bg-gray-500": { bg: "bg-gray-500", hover: "hover:bg-gray-600" },
};

interface StatusHandlingerProps {
  status: string;
  erLaster: boolean;
  onEndreStatus: (nyStatus: string, kommentar?: string) => void;
  onSlett?: () => void;
}

export function StatusHandlinger({ status, erLaster, onEndreStatus, onSlett }: StatusHandlingerProps) {
  const [bekreftHandling, setBekreftHandling] = useState<string | null>(null);
  const [kommentar, setKommentar] = useState("");

  const handlinger = hentStatusHandlinger(status);

  if (handlinger.length === 0) return null;

  const håndterKlikk = (nyStatus: string) => {
    if (nyStatus === "deleted") {
      if (bekreftHandling === "deleted") {
        onSlett?.();
        setBekreftHandling(null);
      } else {
        setBekreftHandling("deleted");
        setKommentar("");
      }
      return;
    }
    if (bekreftHandling === nyStatus) {
      onEndreStatus(nyStatus, kommentar.trim() || undefined);
      setBekreftHandling(null);
      setKommentar("");
    } else {
      setBekreftHandling(nyStatus);
      setKommentar("");
    }
  };

  const avbrytBekreft = () => {
    setBekreftHandling(null);
    setKommentar("");
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {handlinger.map((h) => {
          const farger = FARGE_MAP[h.farge] ?? { bg: "bg-gray-600", hover: "hover:bg-gray-700" };
          const erValgt = bekreftHandling === h.nyStatus;

          return (
            <button
              key={h.nyStatus}
              onClick={() => håndterKlikk(h.nyStatus)}
              disabled={erLaster}
              className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 ${
                erValgt ? "ring-2 ring-offset-1 ring-gray-400" : ""
              } ${farger.bg} ${farger.hover}`}
            >
              {erLaster ? "Endrer..." : erValgt ? `Bekreft: ${h.tekst}` : h.tekst}
            </button>
          );
        })}
        {bekreftHandling && (
          <button
            onClick={avbrytBekreft}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Avbryt
          </button>
        )}
      </div>
      {bekreftHandling && (
        <input
          type="text"
          value={kommentar}
          onChange={(e) => setKommentar(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onEndreStatus(bekreftHandling, kommentar.trim() || undefined);
              setBekreftHandling(null);
              setKommentar("");
            }
          }}
          placeholder="Valgfri kommentar..."
          className="max-w-md rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          autoFocus
        />
      )}
    </div>
  );
}
