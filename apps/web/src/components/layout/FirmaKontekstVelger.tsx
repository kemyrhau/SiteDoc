"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslation } from "react-i18next";
import {
  Building2,
  ChevronDown,
  Search,
  Star,
} from "lucide-react";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { useFavoritter } from "@/hooks/useFavoritter";

const SOK_TERSKEL = 7;

/**
 * «Firma ▾»-velger i topbar når man er i firma-kontekst
 * (pathname starter med /dashbord/firma).
 *
 * Erstatter ProsjektVelger + ByggeplassVelger i firma-modus. Lar bruker
 * hoppe direkte til et prosjekt — naviger til /dashbord/{prosjektId} og
 * Toppbar går automatisk tilbake til vanlig oppsett.
 */
export function FirmaKontekstVelger() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: session } = useSession();
  const { prosjekter } = useProsjekt();
  const { erFavoritt, toggleFavoritt } = useFavoritter(session?.user?.id);

  const [apen, setApen] = useState(false);
  const [sok, setSok] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKlikk(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setApen(false);
      }
    }
    document.addEventListener("mousedown", handleKlikk);
    return () => document.removeEventListener("mousedown", handleKlikk);
  }, []);

  const visSok = prosjekter.length > SOK_TERSKEL;

  const filtrerte = useMemo(() => {
    const q = sok.toLowerCase();
    if (!q) return prosjekter;
    return prosjekter.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.projectNumber.toLowerCase().includes(q),
    );
  }, [prosjekter, sok]);

  const favoritter = filtrerte.filter((p) => erFavoritt(p.id));
  const andre = filtrerte.filter((p) => !erFavoritt(p.id));

  function handleVelg(prosjektId: string) {
    router.push(`/dashbord/${prosjektId}`);
    setApen(false);
    setSok("");
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setApen(!apen)}
        className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white transition-colors hover:bg-white/20"
      >
        <Building2 className="h-4 w-4" />
        <span>{t("topbar.firma")}</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${apen ? "rotate-180" : ""}`}
        />
      </button>

      {apen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-gray-200 bg-white shadow-xl">
          {visSok && (
            <div className="border-b border-gray-100 p-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={sok}
                  onChange={(e) => setSok(e.target.value)}
                  placeholder={t("topbar.sokProsjekt")}
                  className="w-full rounded-md border border-gray-200 py-1.5 pl-8 pr-3 text-sm text-gray-700 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                  autoFocus
                />
              </div>
            </div>
          )}

          <div className="max-h-[320px] overflow-auto py-1">
            {filtrerte.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-400">
                {t("topbar.ingenProsjekter")}
              </p>
            ) : (
              <>
                {favoritter.length > 0 && (
                  <>
                    <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                      {t("topbar.favoritter")}
                    </p>
                    {favoritter.map((p) => (
                      <ProsjektRad
                        key={p.id}
                        id={p.id}
                        navn={p.name}
                        nummer={p.projectNumber}
                        favoritt={true}
                        onVelg={() => handleVelg(p.id)}
                        onToggleFavoritt={() => toggleFavoritt(p.id)}
                      />
                    ))}
                  </>
                )}

                {andre.length > 0 && (
                  <>
                    {favoritter.length > 0 && (
                      <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                        {t("topbar.alleProsjekter")}
                      </p>
                    )}
                    {andre.map((p) => (
                      <ProsjektRad
                        key={p.id}
                        id={p.id}
                        navn={p.name}
                        nummer={p.projectNumber}
                        favoritt={false}
                        onVelg={() => handleVelg(p.id)}
                        onToggleFavoritt={() => toggleFavoritt(p.id)}
                      />
                    ))}
                  </>
                )}
              </>
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
  onVelg,
  onToggleFavoritt,
}: {
  id: string;
  navn: string;
  nummer: string;
  favoritt: boolean;
  onVelg: () => void;
  onToggleFavoritt: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 px-2 py-1 hover:bg-blue-50">
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
        className="flex flex-1 flex-col py-1 text-left"
      >
        <span className="text-sm font-medium text-gray-900">{navn}</span>
        <span className="text-xs text-gray-500">{nummer}</span>
      </button>
    </div>
  );
}
