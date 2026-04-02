"use client";

import { useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Globe, Loader2, RefreshCw, Check, X } from "lucide-react";
import { Button } from "@sitedoc/ui";
import Link from "next/link";
import { STOETTEDE_SPRAAK } from "@sitedoc/shared";

export default function DokumentLeser() {
  const { t, i18n } = useTranslation();
  const params = useParams();
  const searchParams = useSearchParams();
  const prosjektId = params.prosjektId as string;
  const dokumentId = params.dokumentId as string;
  const highlight = searchParams.get("highlight") ?? "";

  const [språk, setSpråk] = useState(i18n.language || "nb");
  const [visSpraakmeny, setVisSpraakmeny] = useState(false);
  const [sammenlignBlokk, setSammenlignBlokk] = useState<{ id: string; content: string } | null>(null);

  const { data, isLoading, refetch } = trpc.mappe.hentDokumentBlokker.useQuery(
    { documentId: dokumentId, language: språk },
    { enabled: !!dokumentId },
  );

  // Sammenlign-query (lazy) — sender blokkId, API henter norsk original
  const { data: sammenlignData, isLoading: sammenlignLaster } = trpc.modul.sammenlignOversettelse.useQuery(
    { projectId: prosjektId, blokkId: sammenlignBlokk?.id ?? "", targetLang: språk },
    { enabled: !!sammenlignBlokk && språk !== "nb" },
  );

  // Re-oversett mutation
  const reOversettMut = trpc.modul.reOversettDokument.useMutation({
    onSuccess: () => {
      setSammenlignBlokk(null);
      // Poll for ferdig oversettelse
      const interval = setInterval(() => {
        refetch().then((r) => {
          if (r.data && r.data.blokker.length > 0) clearInterval(interval);
        });
      }, 5000);
      setTimeout(() => clearInterval(interval), 120000);
    },
  });

  const valgtSpråkInfo = STOETTEDE_SPRAAK.find((s) => s.kode === språk);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!data || data.blokker.length === 0) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <p className="text-gray-500">{t("tom.ingenData")}</p>
        <Link
          href={`/dashbord/${prosjektId}/mapper`}
          className="text-sm text-sitedoc-primary hover:underline"
        >
          {t("handling.tilbake")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-gray-50">
      {/* Topplinje */}
      <header className="shrink-0 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            href={`/dashbord/${prosjektId}/mapper`}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="max-w-md truncate text-sm font-semibold text-gray-900">
            {data.filename}
          </h1>
        </div>

        {/* Språkvelger */}
        {data.tilgjengeligeSprak.length > 1 && (
          <div className="relative">
            <button
              onClick={() => setVisSpraakmeny(!visSpraakmeny)}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Globe className="h-4 w-4" />
              {valgtSpråkInfo?.flagg} {valgtSpråkInfo?.navn ?? språk}
            </button>
            {visSpraakmeny && (
              <div className="absolute right-0 top-full z-20 mt-1 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                {data.tilgjengeligeSprak.map((kode) => {
                  const info = STOETTEDE_SPRAAK.find((s) => s.kode === kode);
                  return (
                    <button
                      key={kode}
                      onClick={() => {
                        setSpråk(kode);
                        setVisSpraakmeny(false);
                      }}
                      className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-50 ${
                        kode === språk ? "bg-blue-50 font-medium text-sitedoc-primary" : "text-gray-700"
                      }`}
                    >
                      <span>{info?.flagg ?? "🌐"}</span>
                      <span>{info?.navn ?? kode}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </header>

      {/* Innhold */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-8">
        {data.blokker.map((blokk) => {
          const innhold = highlightTekst(blokk.content, highlight);
          const erKlikkbar = språk !== "nb" && ["heading", "text", "caption"].includes(blokk.blockType);
          const erValgt = sammenlignBlokk?.id === blokk.id;

          // Wrapper som rendrer blokk + inline sammenlign-panel
          const blokkElement = (() => {
            switch (blokk.blockType) {
            case "heading": {
              const Tag = `h${Math.min(blokk.headingLevel ?? 2, 6)}` as keyof JSX.IntrinsicElements;
              const størrelse = {
                1: "text-2xl font-bold mt-10 mb-4",
                2: "text-xl font-bold mt-8 mb-3",
                3: "text-lg font-semibold mt-6 mb-2",
                4: "text-base font-semibold mt-5 mb-2",
                5: "text-sm font-semibold mt-4 mb-1",
                6: "text-sm font-medium mt-3 mb-1",
              }[blokk.headingLevel ?? 2] ?? "text-lg font-semibold mt-6 mb-2";

              return (
                <Tag
                  className={`text-gray-900 ${størrelse} ${erKlikkbar ? "cursor-pointer rounded px-1 -mx-1 hover:bg-amber-50 transition-colors" : ""} ${erValgt ? "bg-amber-100 rounded px-1 -mx-1" : ""}`}
                  onClick={erKlikkbar ? () => setSammenlignBlokk(erValgt ? null : { id: blokk.id, content: blokk.content }) : undefined}
                  dangerouslySetInnerHTML={{ __html: innhold }}
                />
              );
            }

            case "text":
              return (
                <div
                  className={`mb-4 whitespace-pre-wrap text-base leading-7 text-gray-800 ${erKlikkbar ? "cursor-pointer rounded px-1 -mx-1 hover:bg-amber-50 transition-colors" : ""} ${erValgt ? "bg-amber-100 rounded px-1 -mx-1" : ""}`}
                  onClick={erKlikkbar ? () => setSammenlignBlokk(erValgt ? null : { id: blokk.id, content: blokk.content }) : undefined}
                  dangerouslySetInnerHTML={{ __html: innhold }}
                />
              );

            case "image":
              return blokk.imageUrl ? (
                <figure key={blokk.id} className="my-6">
                  <img
                    src={`/api${blokk.imageUrl}`}
                    alt=""
                    className="mx-auto max-h-96 rounded-lg border border-gray-200 shadow-sm"
                    loading="lazy"
                  />
                </figure>
              ) : null;

            case "caption":
              return (
                <figcaption
                  className={`mb-6 text-center text-sm italic text-gray-500 ${erKlikkbar ? "cursor-pointer hover:bg-amber-50 transition-colors" : ""} ${erValgt ? "bg-amber-100" : ""}`}
                  onClick={erKlikkbar ? () => setSammenlignBlokk(erValgt ? null : { id: blokk.id, content: blokk.content }) : undefined}
                  dangerouslySetInnerHTML={{ __html: innhold }}
                />
              );

            case "table":
              return (
                <div
                  className="my-4 overflow-x-auto rounded-lg border border-gray-200"
                  dangerouslySetInnerHTML={{ __html: blokk.content }}
                />
              );

            default:
              return (
                <p className="mb-4 text-gray-700">
                  {blokk.content}
                </p>
              );
            }
          })();

          return (
            <div key={blokk.id}>
              {blokkElement}
              {/* Inline sammenlign-panel — vises rett under den klikkede blokken */}
              {erValgt && språk !== "nb" && (
                <div className="mb-6 mt-2 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 shadow-md">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-900">Sammenlign oversettelse</h4>
                    <button onClick={() => setSammenlignBlokk(null)} className="rounded p-1 text-gray-400 hover:bg-amber-100">
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Kildetekst (original) */}
                  {sammenlignData?.norskOriginal && (
                    <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                        Original ({STOETTEDE_SPRAAK.find((s) => s.kode === (sammenlignData.kildesprak ?? "nb"))?.navn ?? "Norsk"})
                      </span>
                      <p className="mt-1 text-sm text-gray-700">{sammenlignData.norskOriginal}</p>
                    </div>
                  )}

                  {sammenlignLaster ? (
                    <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin" /> Henter oversettelser fra tilgjengelige motorer...
                    </div>
                  ) : sammenlignData?.oversettelser && sammenlignData.oversettelser.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      {sammenlignData.oversettelser.map((r) => (
                        <div key={r.motor} className={`rounded-lg border p-3 bg-white ${r.feil ? "border-red-200" : "border-gray-200"}`}>
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-xs font-semibold text-gray-700">{r.navn}</span>
                            {r.feil ? (
                              <span className="text-[10px] text-red-500">{r.feil.slice(0, 60)}</span>
                            ) : (
                              <button
                                onClick={() => {
                                  reOversettMut.mutate({
                                    projectId: prosjektId,
                                    documentId: dokumentId,
                                    targetLang: språk,
                                    motor: r.motor as "opus-mt" | "google" | "deepl",
                                  });
                                }}
                                disabled={reOversettMut.isPending}
                                className="flex items-center gap-1.5 rounded-lg bg-sitedoc-primary px-3 py-1 text-xs font-medium text-white hover:bg-sitedoc-secondary disabled:opacity-50"
                              >
                                <RefreshCw className="h-3 w-3" />
                                Re-oversett hele dokumentet
                              </button>
                            )}
                          </div>
                          {r.resultat && (
                            <p className="text-sm leading-6 text-gray-800">{r.resultat}</p>
                          )}
                        </div>
                      ))}

                      {reOversettMut.isPending && (
                        <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
                          <Loader2 className="h-4 w-4 animate-spin" /> Re-oversetter hele dokumentet — dette tar noen minutter...
                        </div>
                      )}
                      {reOversettMut.isSuccess && (
                        <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700">
                          <Check className="h-4 w-4" /> Oversettelse startet — siden oppdateres automatisk
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Ingen alternative oversettelser tilgjengelig. Legg til API-nøkkel i modulinnstillingene for Google Translate eller DeepL.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
        </div>
      </main>
    </div>
  );
}

/**
 * Highlight søkeord i tekst med <mark> tags.
 */
function highlightTekst(tekst: string, query: string): string {
  if (!query.trim()) return escapeHtml(tekst);

  const escaped = escapeHtml(tekst);
  const ord = query.split(/\s+/).filter((o) => o.length > 2);
  if (ord.length === 0) return escaped;

  const mønster = new RegExp(`(${ord.map(escapeRegex).join("|")})`, "gi");
  return escaped.replace(mønster, '<mark class="bg-yellow-200 rounded px-0.5">$1</mark>');
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
