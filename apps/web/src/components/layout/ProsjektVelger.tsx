"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, Building2, LayoutGrid, Star } from "lucide-react";
import { useSession } from "next-auth/react";
import { useTranslation } from "react-i18next";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { useFirma } from "@/kontekst/firma-kontekst";
import { useFavoritter } from "@/hooks/useFavoritter";

export function ProsjektVelger() {
  const {
    valgtProsjekt,
    prosjekter,
    mineProsjekter,
    velgProsjekt,
    prosjektScope,
    velgScope,
  } = useProsjekt();
  const { erSitedocAdmin, erCompanyAdmin } = useFirma();
  const { data: session } = useSession();
  const { erFavoritt, toggleFavoritt } = useFavoritter(session?.user?.id);
  const { t } = useTranslation();
  const [apen, setApen] = useState(false);
  const [sok, setSok] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const visScopeRader = erSitedocAdmin || erCompanyAdmin;

  useEffect(() => {
    function handleKlikk(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setApen(false);
      }
    }
    document.addEventListener("mousedown", handleKlikk);
    return () => document.removeEventListener("mousedown", handleKlikk);
  }, []);

  const filtrerte = prosjekter.filter((p) =>
    p.name.toLowerCase().includes(sok.toLowerCase()) ||
    p.projectNumber.toLowerCase().includes(sok.toLowerCase()),
  );

  const knappTekst =
    prosjektScope === "enkelt"
      ? valgtProsjekt?.name ?? t("prosjektVelger.velgProsjekt")
      : prosjektScope === "alle"
        ? t("prosjektVelger.alleProsjekter")
        : t("prosjektVelger.mineProsjekter");

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setApen(!apen)}
        className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white transition-colors hover:bg-white/20"
      >
        <Building2 className="h-4 w-4" />
        <span className="max-w-[200px] truncate">{knappTekst}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${apen ? "rotate-180" : ""}`} />
      </button>

      {apen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-gray-200 bg-white shadow-xl">
          <div className="border-b border-gray-100 p-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={sok}
                onChange={(e) => setSok(e.target.value)}
                placeholder={t("prosjektVelger.sok")}
                className="w-full rounded-md border border-gray-200 py-1.5 pl-8 pr-3 text-sm text-gray-700 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                autoFocus
              />
            </div>
          </div>
          {visScopeRader && (
            <div className="border-b border-gray-100 py-1">
              <button
                onClick={() => {
                  velgScope("alle");
                  setApen(false);
                  setSok("");
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-blue-50 ${
                  prosjektScope === "alle" ? "bg-blue-50" : ""
                }`}
              >
                <LayoutGrid className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-900">
                  {t("prosjektVelger.alleProsjekter")}
                </span>
                <span className="ml-auto text-xs text-gray-500">
                  {prosjekter.length}
                </span>
              </button>
              <button
                onClick={() => {
                  velgScope("mine");
                  setApen(false);
                  setSok("");
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-blue-50 ${
                  prosjektScope === "mine" ? "bg-blue-50" : ""
                }`}
              >
                <Star className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-900">
                  {t("prosjektVelger.mineProsjekter")}
                </span>
                <span className="ml-auto text-xs text-gray-500">
                  {mineProsjekter.length}
                </span>
              </button>
            </div>
          )}
          <div className="max-h-64 overflow-auto py-1">
            {filtrerte.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-400">
                {t("prosjektVelger.ingen")}
              </p>
            ) : (
              (() => {
                const favoritter = filtrerte.filter((p) => erFavoritt(p.id));
                const andre = filtrerte.filter((p) => !erFavoritt(p.id));
                const visSeksjonsLabel = favoritter.length > 0;
                return (
                  <>
                    {favoritter.length > 0 && (
                      <>
                        <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                          {t("topbar.favoritter")}
                        </p>
                        {favoritter.map((p) => (
                          <ProsjektRad
                            key={p.id}
                            navn={p.name}
                            nummer={p.projectNumber}
                            favoritt={true}
                            valgt={
                              valgtProsjekt?.id === p.id &&
                              prosjektScope === "enkelt"
                            }
                            onVelg={() => {
                              velgProsjekt(p.id);
                              setApen(false);
                              setSok("");
                            }}
                            onToggleFavoritt={() => toggleFavoritt(p.id)}
                          />
                        ))}
                      </>
                    )}
                    {andre.length > 0 && (
                      <>
                        {visSeksjonsLabel && (
                          <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                            {t("topbar.alleProsjekter")}
                          </p>
                        )}
                        {andre.map((p) => (
                          <ProsjektRad
                            key={p.id}
                            navn={p.name}
                            nummer={p.projectNumber}
                            favoritt={false}
                            valgt={
                              valgtProsjekt?.id === p.id &&
                              prosjektScope === "enkelt"
                            }
                            onVelg={() => {
                              velgProsjekt(p.id);
                              setApen(false);
                              setSok("");
                            }}
                            onToggleFavoritt={() => toggleFavoritt(p.id)}
                          />
                        ))}
                      </>
                    )}
                  </>
                );
              })()
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ProsjektRad({
  navn,
  nummer,
  favoritt,
  valgt,
  onVelg,
  onToggleFavoritt,
}: {
  navn: string;
  nummer: string;
  favoritt: boolean;
  valgt: boolean;
  onVelg: () => void;
  onToggleFavoritt: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={`flex items-center gap-2 px-2 hover:bg-blue-50 ${valgt ? "bg-blue-50" : ""}`}
    >
      <button
        type="button"
        onClick={onToggleFavoritt}
        className="rounded p-1 text-gray-300 transition-colors hover:bg-gray-100 hover:text-amber-500"
        aria-label={
          favoritt ? t("topbar.fjernFavoritt") : t("topbar.leggTilFavoritt")
        }
      >
        <Star
          className={`h-3.5 w-3.5 ${favoritt ? "fill-amber-400 text-amber-400" : ""}`}
        />
      </button>
      <button
        type="button"
        onClick={onVelg}
        className="flex flex-1 flex-col py-1.5 text-left"
      >
        <span className="text-sm font-medium text-gray-900">{navn}</span>
        <span className="text-xs text-gray-500">{nummer}</span>
      </button>
    </div>
  );
}
