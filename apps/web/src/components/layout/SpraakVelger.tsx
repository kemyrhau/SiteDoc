"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { STOETTEDE_SPRAAK } from "@sitedoc/shared";
import type { SpraakKode } from "@sitedoc/shared";
import { byttSpraak } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Globe } from "lucide-react";

export function SpraakVelger() {
  const { i18n } = useTranslation();
  const [aapen, setAapen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const oppdaterSpraak = trpc.bruker.oppdaterSpraak.useMutation();

  const aktivtSpraak = STOETTEDE_SPRAAK.find((s) => s.kode === i18n.language) ?? STOETTEDE_SPRAAK[0];

  useEffect(() => {
    function handleKlikk(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAapen(false);
      }
    }
    document.addEventListener("mousedown", handleKlikk);
    return () => document.removeEventListener("mousedown", handleKlikk);
  }, []);

  async function velgSpraak(kode: SpraakKode) {
    setAapen(false);
    await byttSpraak(kode);
    oppdaterSpraak.mutate({ language: kode });
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setAapen(!aapen)}
        className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-blue-100 transition-colors hover:bg-white/10 hover:text-white"
        title={aktivtSpraak.navn}
      >
        <Globe className="h-4 w-4" />
        <span className="hidden sm:inline">{aktivtSpraak.flagg}</span>
      </button>

      {aapen && (
        <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-xl">
          {STOETTEDE_SPRAAK.map((spraak) => (
            <button
              key={spraak.kode}
              onClick={() => velgSpraak(spraak.kode)}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-gray-50 ${
                spraak.kode === i18n.language
                  ? "font-medium text-sitedoc-primary bg-sitedoc-primary/5"
                  : "text-gray-700"
              }`}
            >
              <span className="text-base">{spraak.flagg}</span>
              <span>{spraak.navn}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
