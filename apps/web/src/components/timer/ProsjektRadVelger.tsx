"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface ProsjektForVelger {
  id: string;
  name: string;
  projectNumber: string;
  // Fase 2 / T.10: "internt" markeres med merke i velgeren (ikke-prosjekt-tid).
  type?: string;
}

interface ProsjektRadVelgerProps {
  valgtId: string | null;
  onVelg: (id: string) => void;
  prosjekter: ProsjektForVelger[];
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Lokal prosjekt-velger for timer-rad-modaler og dagsseddel-grupper.
 * Påvirker ikke global ProsjektKontekst eller toppbarens valgte prosjekt.
 * Søkbar når listen er > 7 elementer.
 */
export function ProsjektRadVelger({
  valgtId,
  onVelg,
  prosjekter,
  placeholder,
  disabled,
}: ProsjektRadVelgerProps) {
  const { t } = useTranslation();
  const [apen, setApen] = useState(false);
  const [sok, setSok] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKlikk(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setApen(false);
      }
    }
    document.addEventListener("click", handleKlikk);
    return () => document.removeEventListener("click", handleKlikk);
  }, []);

  const filtrerte = useMemo(() => {
    if (!sok.trim()) return prosjekter;
    const q = sok.toLowerCase();
    return prosjekter.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.projectNumber.toLowerCase().includes(q),
    );
  }, [prosjekter, sok]);

  const valgt = prosjekter.find((p) => p.id === valgtId) ?? null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setApen(!apen)}
        disabled={disabled}
        className="flex w-full items-center justify-between gap-2 rounded border border-gray-300 bg-white px-3 py-2 text-left text-sm text-gray-900 hover:border-gray-400 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
      >
        <span className={valgt ? "" : "text-gray-400"}>
          {valgt
            ? `${valgt.name}${
                valgt.projectNumber ? ` (${valgt.projectNumber})` : ""
              }`
            : (placeholder ?? t("prosjektVelger.velgProsjekt"))}
        </span>
        <ChevronDown className="h-4 w-4 text-gray-400" />
      </button>
      {apen && !disabled && (
        <div className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded border border-gray-200 bg-white shadow-lg">
          {prosjekter.length > 7 && (
            <div className="sticky top-0 border-b border-gray-100 bg-white p-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={sok}
                  onChange={(e) => setSok(e.target.value)}
                  placeholder={t("handling.sok")}
                  className="w-full rounded border border-gray-300 py-1.5 pl-8 pr-2 text-sm"
                  autoFocus
                />
              </div>
            </div>
          )}
          {filtrerte.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-gray-500">
              {t("prosjektVelger.ingen")}
            </div>
          ) : (
            <ul>
              {filtrerte.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onVelg(p.id);
                      setApen(false);
                      setSok("");
                    }}
                    className={`flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                      p.id === valgtId ? "bg-blue-50" : ""
                    }`}
                  >
                    <span className="flex items-center gap-2 font-medium text-gray-900">
                      {p.name}
                      {p.type === "internt" && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                          {t("timer.internt")}
                        </span>
                      )}
                    </span>
                    {p.projectNumber && (
                      <span className="text-xs text-gray-500">
                        {p.projectNumber}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
