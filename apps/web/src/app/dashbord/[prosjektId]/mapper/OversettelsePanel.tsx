"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { X, Loader2 } from "lucide-react";
import { STOETTEDE_SPRAAK } from "@sitedoc/shared";
import { trpc } from "@/lib/trpc";

// Løs cache-form for optimistisk setData (unngår tRPC-ens dype dokument-type).
type OptimistiskCache = {
  mappeSprak?: string[];
  dokumenter: Array<{
    sourceLanguage: string;
    oversettelse?: {
      tilgjengelig: string[];
      pågår: boolean;
      jobber: Array<{ lang: string; status: string }>;
    } | null;
    [k: string]: unknown;
  }>;
  [k: string]: unknown;
};

/**
 * Oversettelsespanel på mappe (2b) — samler språkaktivering på mappenivå.
 * Ingen ny datamodell: bruker Folder.languageMode/languages via
 * mappe.oppdaterSpraak / settSpraakArv, og batch-jobber via
 * mappe.oversettGjenstaaende. Bak nyNavigasjon-flagget (montert av mapper-siden).
 */
export function OversettelsePanel({
  folderId,
  kildesprak,
  onLukk,
}: {
  folderId: string;
  kildesprak: string;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  const { data: omfang, isLoading } = trpc.mappe.oversettelseOmfang.useQuery({ folderId });

  const arvet = omfang?.kildesprak.arvet ?? true;
  const effektiveMal = useMemo(
    () => (omfang?.malSprak ?? []).filter((l) => l !== kildesprak),
    [omfang?.malSprak, kildesprak],
  );

  const [modus, setModus] = useState<"arv" | "egne">("arv");
  const [valgte, setValgte] = useState<string[]>([]);

  // Synk lokal state når omfang er lastet / mappe byttes.
  useEffect(() => {
    if (!omfang) return;
    setModus(arvet ? "arv" : "egne");
    setValgte(effektiveMal);
  }, [omfang, arvet, effektiveMal]);

  const invalider = () => {
    utils.mappe.oversettelseOmfang.invalidate({ folderId });
    utils.mappe.hentDokumenter.invalidate({ folderId });
  };

  const arvMut = trpc.mappe.settSpraakArv.useMutation({ onSuccess: invalider });
  const egneMut = trpc.mappe.oppdaterSpraak.useMutation({ onSuccess: invalider });
  const oversettMut = trpc.mappe.oversettGjenstaaende.useMutation({
    onSuccess: () => {
      // v3b: optimistisk chip-overgang til amber «…» ved 200 OK — uavhengig av
      // når jobb-løkka fullfører. Manglende målspråk på oversettbare dokumenter
      // (de med kildespråk-blokker) markeres som pågår. Ekte data hentes rett etter.
      // Løs-typet updater + cast for å unngå tRPC TS2589 (dyp dokument-type).
      utils.mappe.hentDokumenter.setData({ folderId }, ((gammel: OptimistiskCache | undefined) => {
        if (!gammel || Array.isArray(gammel)) return gammel;
        const mål = gammel.mappeSprak ?? [];
        return {
          ...gammel,
          dokumenter: gammel.dokumenter.map((d) => {
            const har = new Set(d.oversettelse?.tilgjengelig ?? []);
            if (!har.has(d.sourceLanguage)) return d; // uparset → ikke oversettbar
            const jobber = [...(d.oversettelse?.jobber ?? [])];
            for (const l of mål) {
              if (l === d.sourceLanguage || har.has(l)) continue;
              if (!jobber.some((j) => j.lang === l)) jobber.push({ lang: l, status: "pending" });
            }
            return { ...d, oversettelse: { tilgjengelig: [...har], pågår: jobber.length > 0, jobber } };
          }),
        };
      }) as never);
      invalider();
    },
  });

  const lagrer = arvMut.isPending || egneMut.isPending;

  function velgArv() {
    setModus("arv");
    arvMut.mutate({ id: folderId });
  }
  function velgEgne() {
    setModus("egne");
    // Lagre gjeldende utvalg (minst kildespråk sikres på server).
    if (valgte.length > 0) egneMut.mutate({ id: folderId, languages: valgte, languageMode: "custom" });
  }
  function toggleSpråk(kode: string) {
    const ny = valgte.includes(kode) ? valgte.filter((k) => k !== kode) : [...valgte, kode];
    setValgte(ny);
    if (modus === "egne" && ny.length > 0) {
      egneMut.mutate({ id: folderId, languages: ny, languageMode: "custom" });
    }
  }

  const kildeInfo = STOETTEDE_SPRAAK.find((s) => s.kode === kildesprak);
  const valgbare = STOETTEDE_SPRAAK.filter((s) => s.kode !== kildesprak);

  const gjenstaaende = omfang?.gjenstaaende ?? 0;

  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-l border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">{t("oversettelse.panel.tittel")}</h3>
        <button onClick={onLukk} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
          <X className="h-4 w-4" />
        </button>
      </div>

      {isLoading || !omfang ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {/* KILDESPRÅK */}
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            {t("oversettelse.panel.kildesprak")}
          </p>
          <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
            {kildeInfo?.flagg} {kildeInfo?.navn}
            <span className="text-gray-400"> — {t("oversettelse.panel.fraProsjektet")}</span>
            <Link href="/dashbord/oppsett/prosjektoppsett" className="mt-0.5 block text-[11px] text-sitedoc-secondary hover:underline">
              {t("oversettelse.panel.endreKilde")}
            </Link>
          </div>

          {/* MÅLSPRÅK */}
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            {t("oversettelse.panel.malsprak")}
          </p>
          <label className="mb-1.5 flex items-start gap-2 text-sm text-gray-700">
            <input type="radio" checked={modus === "arv"} onChange={velgArv} disabled={lagrer} className="mt-0.5" />
            <span>
              {t("oversettelse.panel.arv")}
              {effektiveMal.length > 0 && (
                <span className="text-gray-400">
                  {" "}({effektiveMal.map((l) => STOETTEDE_SPRAAK.find((s) => s.kode === l)?.navn ?? l).join(", ")})
                </span>
              )}
            </span>
          </label>
          <label className="mb-2 flex items-start gap-2 text-sm text-gray-700">
            <input type="radio" checked={modus === "egne"} onChange={velgEgne} disabled={lagrer} className="mt-0.5" />
            <span>{t("oversettelse.panel.egne")}</span>
          </label>

          {modus === "egne" && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {valgbare.map((s) => {
                const på = valgte.includes(s.kode);
                return (
                  <button
                    key={s.kode}
                    type="button"
                    onClick={() => toggleSpråk(s.kode)}
                    disabled={lagrer}
                    className={`rounded-full border px-2 py-0.5 text-[12px] transition-colors ${
                      på
                        ? "border-sitedoc-primary bg-sitedoc-primary/10 text-sitedoc-primary"
                        : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    {s.flagg} {s.navn}
                  </button>
                );
              })}
            </div>
          )}

          {/* Infoboks: omfang med begge tall når undermapper bidrar */}
          <div className="mb-3 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-[12px] text-blue-800">
            {omfang.iUndermapper > 0
              ? t("oversettelse.panel.omfangMedUnder", { n: omfang.iMappe, m: omfang.iUndermapper })
              : t("oversettelse.panel.omfang", { n: omfang.iMappe })}
            {" "}
            {/* v5: parentes-klausul med oversettbar-tellingen (samme som knappen)
                → brukeren ser hvorfor «14 dokumenter» kan bli «0 oversettes». */}
            {t("oversettelse.panel.kanOversettes", { g: gjenstaaende })}
            {" "}
            {t("oversettelse.panel.roresIkke")}
          </div>

          {/* Primærknapp */}
          <button
            type="button"
            onClick={() => oversettMut.mutate({ folderId })}
            disabled={gjenstaaende === 0 || oversettMut.isPending || effektiveMal.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-sitedoc-primary px-3 py-2 text-sm font-medium text-white hover:bg-sitedoc-secondary disabled:opacity-50"
          >
            {oversettMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("oversettelse.panel.oversettGjenstaaende", { n: gjenstaaende })}
          </button>
          {oversettMut.data?.modulInaktiv && (
            <p className="mt-2 text-[11px] text-amber-600">{t("oversettelse.panel.modulInaktiv")}</p>
          )}
        </div>
      )}
    </aside>
  );
}
