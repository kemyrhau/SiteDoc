"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, ChevronDown, Check, Search, Star } from "lucide-react";
import { useSession } from "next-auth/react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { useByggeplass } from "@/kontekst/byggeplass-kontekst";
import { useFavoritter } from "@/hooks/useFavoritter";

const SOK_TERSKEL = 7;

interface ByggeplassData {
  id: string;
  name: string;
  number: number | null;
}

export function ByggeplassVelger({ disabled = false }: { disabled?: boolean }) {
  const { t } = useTranslation();
  const { prosjektId } = useProsjekt();
  const { aktivByggeplass, velgByggeplass } = useByggeplass();
  const { data: session } = useSession();
  const { erFavoritt, toggleFavoritt } = useFavoritter(
    session?.user?.id,
    "sitedoc_favoritter_byggeplass",
  );

  const [åpen, setÅpen] = useState(false);
  const [sok, setSok] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const { data: _bygninger } = trpc.bygning.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );
  const bygninger = (_bygninger ?? []) as ByggeplassData[];

  // Auto-velg første byggeplass hvis ingen er valgt
  useEffect(() => {
    if (!aktivByggeplass && bygninger.length > 0 && bygninger[0]) {
      velgByggeplass(bygninger[0]);
    }
  }, [aktivByggeplass, bygninger, velgByggeplass]);

  // Lukk ved klikk utenfor
  useEffect(() => {
    function handleKlikk(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setÅpen(false);
      }
    }
    document.addEventListener("mousedown", handleKlikk);
    return () => document.removeEventListener("mousedown", handleKlikk);
  }, []);

  if (!prosjektId || bygninger.length === 0) return null;

  // Kun én byggeplass — vis navn uten dropdown
  if (bygninger.length === 1) {
    return (
      <div
        className={`flex items-center gap-1.5 text-sm text-blue-200 ${
          disabled ? "opacity-40" : ""
        }`}
      >
        <Building2 className="h-3.5 w-3.5" />
        <span>{bygninger[0]!.name}</span>
      </div>
    );
  }

  const visSok = bygninger.length > SOK_TERSKEL;
  const q = sok.toLowerCase();
  const filtrerte = q
    ? bygninger.filter((b) => b.name.toLowerCase().includes(q))
    : bygninger;

  const favoritter = filtrerte.filter((b) => erFavoritt(b.id));
  const andre = filtrerte.filter((b) => !erFavoritt(b.id));

  function handleVelg(b: ByggeplassData) {
    velgByggeplass(b);
    setÅpen(false);
    setSok("");
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => !disabled && setÅpen(!åpen)}
        disabled={disabled}
        className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors ${
          disabled
            ? "text-blue-200/40 cursor-not-allowed"
            : "text-blue-100 hover:bg-white/10 hover:text-white"
        }`}
      >
        <Building2 className="h-3.5 w-3.5" />
        <span className="max-w-[120px] truncate">
          {aktivByggeplass?.name ?? t("byggeplassVelger.velg")}
        </span>
        <ChevronDown className="h-3 w-3" />
      </button>

      {åpen && !disabled && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-gray-200 bg-white shadow-xl">
          {visSok && (
            <div className="border-b border-gray-100 p-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={sok}
                  onChange={(e) => setSok(e.target.value)}
                  placeholder={t("byggeplassVelger.sok")}
                  className="w-full rounded-md border border-gray-200 py-1.5 pl-8 pr-3 text-sm text-gray-700 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                  autoFocus
                />
              </div>
            </div>
          )}

          <div className="max-h-[320px] overflow-auto py-1">
            {filtrerte.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-400">
                {t("byggeplassVelger.ingen")}
              </p>
            ) : (
              <>
                {favoritter.length > 0 && (
                  <>
                    <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                      {t("topbar.favoritter")}
                    </p>
                    {favoritter.map((b) => (
                      <ByggeplassRad
                        key={b.id}
                        navn={b.name}
                        favoritt={true}
                        valgt={aktivByggeplass?.id === b.id}
                        onVelg={() => handleVelg(b)}
                        onToggleFavoritt={() => toggleFavoritt(b.id)}
                      />
                    ))}
                  </>
                )}
                {andre.length > 0 && (
                  <>
                    {favoritter.length > 0 && (
                      <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                        {t("byggeplassVelger.alle")}
                      </p>
                    )}
                    {andre.map((b) => (
                      <ByggeplassRad
                        key={b.id}
                        navn={b.name}
                        favoritt={false}
                        valgt={aktivByggeplass?.id === b.id}
                        onVelg={() => handleVelg(b)}
                        onToggleFavoritt={() => toggleFavoritt(b.id)}
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

function ByggeplassRad({
  navn,
  favoritt,
  valgt,
  onVelg,
  onToggleFavoritt,
}: {
  navn: string;
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
        className="flex flex-1 items-center gap-2 py-1.5 text-left"
      >
        {valgt ? (
          <Check className="h-3.5 w-3.5 text-sitedoc-primary" />
        ) : (
          <span className="h-3.5 w-3.5" />
        )}
        <span
          className={`text-sm ${valgt ? "font-medium text-sitedoc-primary" : "text-gray-900"}`}
        >
          {navn}
        </span>
      </button>
    </div>
  );
}
