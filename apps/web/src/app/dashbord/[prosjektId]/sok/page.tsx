"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { FileSearch, Search } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { TreffListe } from "@/components/ftd-sok/treff-liste";
import { Fulltekst } from "@/components/ftd-sok/fulltekst";

export default function DokumentsokSide() {
  const params = useParams<{ prosjektId: string }>();
  const prosjektId = params.prosjektId;

  const [query, setQuery] = useState("");
  const [aktivtSok, setAktivtSok] = useState("");
  const [valgtTreffId, setValgtTreffId] = useState<string | null>(null);
  const [valgtDokumentId, setValgtDokumentId] = useState<string | null>(null);

  const { data: treff, isLoading } = trpc.ftdSok.sokDokumenter.useQuery(
    { projectId: prosjektId, query: aktivtSok },
    { enabled: !!prosjektId && aktivtSok.length > 0 },
  );

  const handleSok = () => {
    if (query.trim()) {
      setAktivtSok(query.trim());
      setValgtTreffId(null);
      setValgtDokumentId(null);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Toppseksjon */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <FileSearch className="h-5 w-5 text-sitedoc-primary" />
        <h1 className="text-lg font-semibold">Dokumentsøk</h1>
      </div>

      {/* Søkefelt */}
      <div className="border-b px-4 py-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              className="w-full rounded border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-sitedoc-primary focus:outline-none focus:ring-1 focus:ring-sitedoc-primary"
              placeholder="Søk i prosjektdokumenter..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSok()}
            />
          </div>
          <button
            className="rounded bg-sitedoc-primary px-4 py-2 text-sm text-white hover:bg-sitedoc-secondary disabled:opacity-50"
            onClick={handleSok}
            disabled={!query.trim()}
          >
            Søk
          </button>
        </div>
      </div>

      {/* Resultater */}
      <div className="flex flex-1 overflow-hidden">
        {/* Treffliste */}
        <div className="w-1/2 overflow-y-auto border-r p-4">
          {isLoading ? (
            <div className="py-8 text-center text-sm text-gray-400">
              Søker...
            </div>
          ) : aktivtSok ? (
            <TreffListe
              treff={treff ?? []}
              onVelgTreff={(t) => {
                setValgtTreffId(t.id);
                setValgtDokumentId(t.documentId);
              }}
              valgtId={valgtTreffId}
            />
          ) : (
            <div className="py-8 text-center text-sm text-gray-400">
              Skriv inn søkeord for å søke i prosjektdokumenter.
            </div>
          )}
        </div>

        {/* Fulltekst-panel */}
        <div className="w-1/2 overflow-y-auto p-4">
          {valgtDokumentId ? (
            <Fulltekst documentId={valgtDokumentId} />
          ) : (
            <div className="py-8 text-center text-sm text-gray-400">
              Velg et treff for å se dokumentinnhold.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
