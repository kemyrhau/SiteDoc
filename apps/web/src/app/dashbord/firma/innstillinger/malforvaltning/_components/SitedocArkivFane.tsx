"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Spinner } from "@sitedoc/ui";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight } from "lucide-react";
import { MalBygger } from "@/components/malbygger";
import { Nivaabanner } from "@/components/nivaa/Nivaabanner";

/**
 * SiteDoc-arkiv-fanen i Malforvaltning (flyttet fra `/dashbord/admin/bibliotek`, ordre
 * malforvaltning Krav 3). Uendret form fra vei C del 2 som Kenneth gatet visuelt: venstre
 * trestruktur (Standard → Kapittel → Mal) er navigasjonen, høyre er MalBygger i sitedoc-modus
 * (`nivaa="sitedoc"`, objekt-CRUD mot `trpc.bibliotek.*` → BibliotekMalObjekt-radene).
 * Gatingen ligger i flaten over (kun erSitedocAdmin ser denne fanen).
 */
export function SitedocArkivFane() {
  const { t } = useTranslation();
  const standarderQuery = trpc.bibliotek.hentStandarder.useQuery();
  const [apneStandarder, setApneStandarder] = useState<Record<string, boolean>>({});
  const [valgtMalId, setValgtMalId] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col gap-4">
      <Nivaabanner nivaa="sitedoc" kontekst="liste" />
      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Venstre — trestruktur (navigasjon til sentralmalene) */}
        <aside className="flex w-80 shrink-0 flex-col overflow-y-auto rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-4 py-3">
            <h1 className="text-sm font-semibold text-gray-900">{t("adminBibliotek.tittel")}</h1>
            <p className="text-xs text-gray-500">{t("adminBibliotek.undertittel")}</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {standarderQuery.isLoading ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : (
              (standarderQuery.data ?? []).map((standard) => {
                const apen = apneStandarder[standard.id] ?? true;
                return (
                  <div key={standard.id} className="mb-1">
                    <button
                      onClick={() => setApneStandarder((p) => ({ ...p, [standard.id]: !apen }))}
                      className="flex w-full items-center gap-1 rounded px-2 py-1.5 text-left text-sm font-medium text-gray-800 hover:bg-gray-100"
                    >
                      {apen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                      <span className="truncate">{standard.kode} — {standard.navn}</span>
                    </button>
                    {apen && standard.kapitler.map((kapittel) => (
                      <div key={kapittel.id} className="ml-4 mt-0.5">
                        <div className="px-2 py-1 text-xs font-medium text-gray-500">{kapittel.kode} — {kapittel.navn}</div>
                        {kapittel.maler.map((mal) => (
                          <button
                            key={mal.id}
                            onClick={() => setValgtMalId(mal.id)}
                            className={`ml-2 block w-full truncate rounded px-2 py-1 text-left text-sm ${
                              valgtMalId === mal.id ? "bg-amber-50 font-medium text-amber-700" : "text-gray-700 hover:bg-gray-100"
                            }`}
                          >
                            {mal.navn}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Høyre — MalBygger i sitedoc-modus */}
        <div className="flex-1 overflow-hidden">
          {valgtMalId ? (
            <SitedocMalRedigering key={valgtMalId} bibliotekMalId={valgtMalId} />
          ) : (
            <div className="flex h-full items-center justify-center rounded-lg border border-gray-200 bg-white">
              <p className="text-sm text-gray-400">{t("adminBibliotek.velgMal")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SitedocMalRedigering({ bibliotekMalId }: { bibliotekMalId: string }) {
  const { t } = useTranslation();
  const malQuery = trpc.bibliotek.hent.useQuery({ id: bibliotekMalId });

  if (malQuery.isLoading) {
    return <div className="flex h-full items-center justify-center rounded-lg border border-gray-200 bg-white"><Spinner /></div>;
  }
  if (malQuery.error || !malQuery.data) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-gray-200 bg-white">
        <p className="text-sm text-red-600">{malQuery.error?.message ?? t("adminBibliotek.velgMal")}</p>
      </div>
    );
  }

  return (
    <MalBygger
      nivaa="sitedoc"
      mal={
        malQuery.data as unknown as {
          id: string;
          name: string;
          description: string | null;
          category?: string;
          objects: Array<{
            id: string;
            type: string;
            label: string;
            required: boolean;
            sortOrder: number;
            config: unknown;
            parentId: string | null;
          }>;
        }
      }
    />
  );
}
