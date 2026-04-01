"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { FileSearch, Search, Brain, BookOpen, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { TreffListe } from "@/components/ftd-sok/treff-liste";
import { Fulltekst } from "@/components/ftd-sok/fulltekst";

type SokModus = "ai" | "leksikalsk";

export default function DokumentsokSide() {
  const params = useParams<{ prosjektId: string }>();
  const prosjektId = params.prosjektId;

  const [query, setQuery] = useState("");
  const [aktivtSok, setAktivtSok] = useState("");
  const [valgtTreffId, setValgtTreffId] = useState<string | null>(null);
  const [valgtDokumentId, setValgtDokumentId] = useState<string | null>(null);
  const [modus, setModus] = useState<SokModus>("ai");

  // Sjekk embedding-status
  const { data: embeddingStatus } = trpc.aiSok.embeddingStatus.useQuery(
    { projectId: prosjektId },
    { enabled: !!prosjektId },
  );

  const harEmbeddings = (embeddingStatus?.ferdig ?? 0) > 0;

  // AI-søk (hybrid vektor + leksikalsk + re-ranking)
  const {
    data: aiTreff,
    isLoading: aiLaster,
    error: aiError,
  } = trpc.aiSok.sok.useQuery(
    { projectId: prosjektId, query: aktivtSok },
    { enabled: !!prosjektId && aktivtSok.length > 0 && modus === "ai" && harEmbeddings, retry: false },
  );

  // Leksikalsk søk — kjør ALLTID ved aktivt søk (brukes som fallback)
  const { data: leksTreff, isLoading: leksLaster } =
    trpc.ftdSok.sokDokumenter.useQuery(
      { projectId: prosjektId, query: aktivtSok },
      { enabled: !!prosjektId && aktivtSok.length > 0 },
    );

  // Bestem hva som vises
  const aiAktiv = modus === "ai" && harEmbeddings;
  const aiFeilet = aiAktiv && !!aiError;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let visbareTreff: any[] | undefined = leksTreff;
  let brukFallback = false;

  if (aiAktiv && !aiFeilet && (aiTreff?.length ?? 0) > 0) {
    visbareTreff = aiTreff;
  } else if (aiAktiv) {
    brukFallback = true;
  } else if (modus === "leksikalsk") {
    visbareTreff = leksTreff;
  }

  const isLoading = aiAktiv ? aiLaster && leksLaster : leksLaster;

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

      {/* Søkefelt + modusveksler */}
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

        {/* Modusveksler */}
        <div className="mt-2 flex items-center gap-1">
          <button
            onClick={() => setModus("ai")}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-colors ${
              modus === "ai"
                ? "bg-sitedoc-primary/10 text-sitedoc-primary font-medium"
                : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            <Brain className="h-3.5 w-3.5" />
            AI-søk
            {!harEmbeddings && (
              <span className="text-[10px] text-gray-400">(ingen embeddings)</span>
            )}
          </button>
          <button
            onClick={() => setModus("leksikalsk")}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-colors ${
              modus === "leksikalsk"
                ? "bg-sitedoc-primary/10 text-sitedoc-primary font-medium"
                : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            Tekstsøk
          </button>
        </div>

        {/* Fallback-varsel */}
        {aktivtSok && brukFallback && (
          <div className="mt-2 flex items-center gap-1.5 rounded bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
            {aiFeilet
              ? "AI-søk feilet — viser tekstsøk-resultater i stedet"
              : "AI-søk ga ingen treff — viser tekstsøk-resultater"}
          </div>
        )}
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
              treff={visbareTreff ?? []}
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
            <Fulltekst documentId={valgtDokumentId} søkeord={aktivtSok} />
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
