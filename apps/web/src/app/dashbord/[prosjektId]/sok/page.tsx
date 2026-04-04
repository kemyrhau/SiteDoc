"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { FileSearch, Search, Brain, BookOpen, AlertTriangle, Filter } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { TreffListe } from "@/components/ftd-sok/treff-liste";
import { Fulltekst } from "@/components/ftd-sok/fulltekst";

type SokModus = "ai" | "leksikalsk";

/** Forkort NS-filnavn for dropdown */
function kortFilnavn(filnavn: string): string {
  // "ns-3420-f_2024..." → "NS 3420-F"
  const m = filnavn.match(/ns-(\d{4})-([a-z]+)/i);
  if (m) return `NS ${m[1]}-${m[2]!.toUpperCase()}`;
  // "NS 3420 Del K..." → "NS 3420-K"
  const m2 = filnavn.match(/NS (\d{4}) Del ([A-Z])/);
  if (m2) return `NS ${m2[1]}-${m2[2]}`;
  // "NS 8405..." → "NS 8405"
  const m3 = filnavn.match(/NS[_ ]?(\d{4})/);
  if (m3) return `NS ${m3[1]}`;
  // Fjern .pdf
  return filnavn.replace(/\.pdf$/i, "");
}

export default function DokumentsokSide() {
  const { t } = useTranslation();
  const params = useParams<{ prosjektId: string }>();
  const prosjektId = params.prosjektId;

  const [query, setQuery] = useState("");
  const [aktivtSok, setAktivtSok] = useState("");
  const [valgtTreffId, setValgtTreffId] = useState<string | null>(null);
  const [valgtDokumentId, setValgtDokumentId] = useState<string | null>(null);
  const [modus, setModus] = useState<SokModus>("ai");
  const [nsFilter, setNsFilter] = useState<"ekskluder" | "alle" | string>("ekskluder");
  // string = dokument-ID for enkeltdokument-filter

  // Sjekk embedding-status
  const { data: embeddingStatus } = trpc.aiSok.embeddingStatus.useQuery(
    { projectId: prosjektId },
    { enabled: !!prosjektId },
  );

  const harEmbeddings = (embeddingStatus?.ferdig ?? 0) > 0;

  // Hent NS/referansedokumenter for filter
  const { data: refDok } = trpc.aiSok.hentReferanseDokumenter.useQuery(
    { projectId: prosjektId },
    { enabled: !!prosjektId },
  );

  const nsMappeIder = refDok?.mapper.map((m) => m.id).filter((id) => id !== "__ingen__") ?? [];
  const nsDokumentIder = refDok?.dokumenter.map((d) => d.id) ?? [];

  // Bygg filter basert på valg
  const erEnkeltDok = nsFilter !== "ekskluder" && nsFilter !== "alle";
  const sokFilter = erEnkeltDok
    ? { dokumentIder: [nsFilter] }
    : nsFilter === "ekskluder" && nsMappeIder.length > 0
      ? { ekskluderMappeIder: nsMappeIder }
      : {};

  // AI-søk (hybrid vektor + leksikalsk + re-ranking)
  const {
    data: aiTreff,
    isLoading: aiLaster,
    error: aiError,
  } = trpc.aiSok.sok.useQuery(
    {
      projectId: prosjektId,
      query: aktivtSok,
      ...sokFilter,
    },
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
        <h1 className="text-lg font-semibold">{t("sok.tittel")}</h1>
      </div>

      {/* Søkefelt + modusveksler */}
      <div className="border-b px-4 py-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              className="w-full rounded border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-sitedoc-primary focus:outline-none focus:ring-1 focus:ring-sitedoc-primary"
              placeholder={t("sok.placeholder")}
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
            {t("handling.soek")}
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
            {t("sok.aiSok")}
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
            {t("sok.tekstsok")}
          </button>

          {/* Dokumentfilter */}
          {(refDok?.dokumenter.length ?? 0) > 0 && (
            <div className="ml-auto flex items-center gap-1">
              <Filter className="h-3.5 w-3.5 text-gray-400" />
              <select
                value={nsFilter}
                onChange={(e) => setNsFilter(e.target.value)}
                className="max-w-[220px] rounded border-0 bg-transparent py-0.5 text-xs text-gray-600 focus:ring-0"
              >
                <option value="ekskluder">{t("sok.prosjektdokumenter")}</option>
                <option value="alle">{t("sok.alleDokumenter")}</option>
                <option disabled>──────────</option>
                {refDok?.dokumenter.map((d) => (
                  <option key={d.id} value={d.id}>
                    {kortFilnavn(d.filename)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Fallback-varsel */}
        {aktivtSok && brukFallback && (
          <div className="mt-2 flex items-center gap-1.5 rounded bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
            {aiFeilet
              ? t("sok.fallbackVarselFeilet")
              : t("sok.fallbackVarsel")}
          </div>
        )}
      </div>

      {/* Resultater */}
      <div className="flex min-h-0 flex-1">
        {/* Treffliste */}
        <div className="w-1/2 shrink-0 overflow-y-auto border-r p-4">
          {isLoading ? (
            <div className="py-8 text-center text-sm text-gray-400">
              {t("sok.soeker")}
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
              {t("sok.skrivInnSokeord")}
            </div>
          )}
        </div>

        {/* Fulltekst-panel */}
        <div className="w-1/2 shrink-0 overflow-y-auto bg-gray-50 p-4">
          {valgtDokumentId ? (
            <Fulltekst documentId={valgtDokumentId} søkeord={aktivtSok} />
          ) : (
            <div className="py-8 text-center text-sm text-gray-400">
              {t("sok.klikkPaaTreff")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
