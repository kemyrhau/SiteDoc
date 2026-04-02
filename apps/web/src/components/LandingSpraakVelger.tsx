"use client";

import { useState, useRef, useEffect } from "react";
import { STOETTEDE_SPRAAK } from "@sitedoc/shared";
import type { SpraakKode } from "@sitedoc/shared";
import { byttSpraak, hentLagretSpraak } from "@/lib/i18n";
import { Globe } from "lucide-react";

export function LandingSpraakVelger() {
  const [aapen, setAapen] = useState(false);
  const [aktivKode, setAktivKode] = useState<SpraakKode>("nb");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAktivKode(hentLagretSpraak());
  }, []);

  useEffect(() => {
    function handleKlikk(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAapen(false);
      }
    }
    document.addEventListener("mousedown", handleKlikk);
    return () => document.removeEventListener("mousedown", handleKlikk);
  }, []);

  const aktivtSpraak = STOETTEDE_SPRAAK.find((s) => s.kode === aktivKode) ?? STOETTEDE_SPRAAK[0];

  async function velgSpraak(kode: SpraakKode) {
    setAapen(false);
    setAktivKode(kode);
    await byttSpraak(kode);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setAapen(!aapen)}
        className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-blue-200/80 transition-colors hover:text-white"
        title={aktivtSpraak.navn}
      >
        <Globe className="h-4 w-4" />
        <span className="text-base leading-none">{aktivtSpraak.flagg}</span>
      </button>

      {aapen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-xl">
          {STOETTEDE_SPRAAK.map((spraak) => (
            <button
              key={spraak.kode}
              onClick={() => velgSpraak(spraak.kode)}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-gray-50 ${
                spraak.kode === aktivKode
                  ? "font-medium text-sitedoc-primary bg-blue-50/50"
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
