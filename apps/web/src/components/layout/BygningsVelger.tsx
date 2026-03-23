"use client";

import { useState, useRef, useEffect } from "react";
import { Building2, ChevronDown, Check } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { useBygning } from "@/kontekst/bygning-kontekst";

interface BygningData {
  id: string;
  name: string;
  number: number | null;
}

export function BygningsVelger() {
  const { prosjektId } = useProsjekt();
  const { aktivBygning, velgBygning } = useBygning();
  const [åpen, setÅpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: _bygninger } = trpc.bygning.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );
  const bygninger = (_bygninger ?? []) as BygningData[];

  // Auto-velg første bygning hvis ingen er valgt
  useEffect(() => {
    if (!aktivBygning && bygninger.length > 0 && bygninger[0]) {
      velgBygning(bygninger[0]);
    }
  }, [aktivBygning, bygninger, velgBygning]);

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

  // Kun én bygning — vis navn uten dropdown
  if (bygninger.length === 1) {
    return (
      <div className="flex items-center gap-1.5 text-sm text-blue-200">
        <Building2 className="h-3.5 w-3.5" />
        <span>{bygninger[0]!.name}</span>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setÅpen(!åpen)}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-blue-100 transition-colors hover:bg-white/10 hover:text-white"
      >
        <Building2 className="h-3.5 w-3.5" />
        <span className="max-w-[120px] truncate">
          {aktivBygning?.name ?? "Velg bygning"}
        </span>
        <ChevronDown className="h-3 w-3" />
      </button>

      {åpen && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[180px] rounded-lg border border-gray-200 bg-white py-1 shadow-xl">
          {bygninger.map((b) => (
            <button
              key={b.id}
              onClick={() => {
                velgBygning(b);
                setÅpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              {aktivBygning?.id === b.id ? (
                <Check className="h-3.5 w-3.5 text-sitedoc-primary" />
              ) : (
                <span className="h-3.5 w-3.5" />
              )}
              <span className={aktivBygning?.id === b.id ? "font-medium text-sitedoc-primary" : ""}>
                {b.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
