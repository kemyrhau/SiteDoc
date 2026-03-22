"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { useBygning } from "@/kontekst/bygning-kontekst";
import { useBilder } from "@/kontekst/bilder-kontekst";
import { Spinner } from "@sitedoc/ui";
import {
  Image,
  Map,
  Building2,
  ChevronDown,
  ChevronRight,
  Layers,
  MapPin,
} from "lucide-react";

interface TegningInfo {
  id: string;
  name: string;
  fileType: string | null;
  floor: string | null;
  geoReference: unknown;
  buildingId: string | null;
}

interface BygningMedTegninger {
  id: string;
  name: string;
  number: number | null;
  drawings: TegningInfo[];
}

export function BilderPanel() {
  const params = useParams<{ prosjektId: string }>();
  const { aktivBygning, velgBygning, aktivTegning, settAktivTegning } = useBygning();
  const { visningsmodus, settVisningsmodus } = useBilder();
  const [utvidede, setUtvidede] = useState<Set<string>>(new Set());

  const { data: bygninger, isLoading } = trpc.bygning.hentForProsjekt.useQuery(
    { projectId: params.prosjektId },
    { enabled: !!params.prosjektId },
  );

  function toggleUtvid(nokkel: string) {
    setUtvidede((prev) => {
      const ny = new Set(prev);
      if (ny.has(nokkel)) ny.delete(nokkel);
      else ny.add(nokkel);
      return ny;
    });
  }

  function handleVelgTegning(tegning: TegningInfo, bygningId: string) {
    settVisningsmodus("tegning");
    settAktivTegning(aktivTegning?.id === tegning.id ? null : tegning);
    if (aktivBygning?.id !== bygningId) {
      const byg = bygninger?.find((b) => b.id === bygningId) as BygningMedTegninger | undefined;
      if (byg) {
        velgBygning({ id: byg.id, name: byg.name, number: byg.number });
        setUtvidede((prev) => new Set(prev).add(bygningId));
      }
    }
  }

  function grupperTegninger(tegninger: TegningInfo[]) {
    const etasjeMap: Record<string, TegningInfo[]> = {};
    const utenEtasje: TegningInfo[] = [];
    for (const t of tegninger) {
      if (t.floor != null && t.floor.trim() !== "") {
        const key = t.floor;
        if (!etasjeMap[key]) etasjeMap[key] = [];
        etasjeMap[key]!.push(t);
      } else {
        utenEtasje.push(t);
      }
    }
    const sorterteEtasjer = Object.keys(etasjeMap).sort((a, b) =>
      a.localeCompare(b, "nb-NO", { numeric: true }),
    );
    return { etasjeMap, sorterteEtasjer, utenEtasje };
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Visningsmodus-toggle */}
      <div className="flex gap-1 rounded-md bg-gray-100 p-0.5">
        <button
          onClick={() => settVisningsmodus("liste")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition-colors ${
            visningsmodus === "liste"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Image className="h-3.5 w-3.5" />
          Liste
        </button>
        <button
          onClick={() => settVisningsmodus("tegning")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition-colors ${
            visningsmodus === "tegning"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Map className="h-3.5 w-3.5" />
          Tegning
        </button>
      </div>

      {/* Tegningsvelger (kun synlig i tegningsvisning) */}
      {visningsmodus === "tegning" && (
        <div className="flex flex-col gap-0.5">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Spinner size="sm" />
            </div>
          ) : (
            <>
              {(bygninger as unknown as BygningMedTegninger[] | undefined)?.map((bygning) => {
                const erUtvidet = utvidede.has(bygning.id);
                const tegningerUtenIfc = bygning.drawings.filter((t) => t.fileType?.toLowerCase() !== "ifc");
                const { etasjeMap, sorterteEtasjer, utenEtasje } = grupperTegninger(tegningerUtenIfc);

                return (
                  <div key={bygning.id}>
                    <button
                      onClick={() => {
                        toggleUtvid(bygning.id);
                        velgBygning({ id: bygning.id, name: bygning.name, number: bygning.number });
                      }}
                      className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors ${
                        aktivBygning?.id === bygning.id
                          ? "bg-blue-50 text-blue-700 font-medium"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {erUtvidet ? (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <Building2 className="h-4 w-4 shrink-0" />
                      <span className="truncate text-left flex-1">
                        {bygning.number ? `${bygning.number}. ` : ""}
                        {bygning.name}
                      </span>
                    </button>

                    {erUtvidet && (
                      <div className="ml-6 flex flex-col gap-0.5 mt-0.5">
                        {sorterteEtasjer.map((etasje) => {
                          const etasjeNokkel = `${bygning.id}::${etasje}`;
                          const erEtasjeUtvidet = utvidede.has(etasjeNokkel);
                          const tegninger = etasjeMap[etasje] ?? [];

                          return (
                            <div key={etasje}>
                              <button
                                onClick={() => toggleUtvid(etasjeNokkel)}
                                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
                              >
                                {erEtasjeUtvidet ? (
                                  <ChevronDown className="h-3 w-3 shrink-0" />
                                ) : (
                                  <ChevronRight className="h-3 w-3 shrink-0" />
                                )}
                                <Layers className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate text-left flex-1 font-medium">{etasje}</span>
                                <span className="text-xs text-gray-400">({tegninger.length})</span>
                              </button>

                              {erEtasjeUtvidet && (
                                <div className="ml-5 flex flex-col gap-0.5 mt-0.5">
                                  {tegninger.map((t) => (
                                    <button
                                      key={t.id}
                                      onClick={() => handleVelgTegning(t, bygning.id)}
                                      className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors ${
                                        aktivTegning?.id === t.id
                                          ? "text-blue-700 bg-blue-50/50"
                                          : "text-gray-600 hover:bg-gray-50"
                                      }`}
                                    >
                                      <MapPin className="h-3 w-3 shrink-0 text-gray-400" />
                                      <span className="truncate text-left flex-1">{t.name}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {utenEtasje.length > 0 &&
                          utenEtasje.map((t) => (
                            <button
                              key={t.id}
                              onClick={() => handleVelgTegning(t, bygning.id)}
                              className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors ${
                                aktivTegning?.id === t.id
                                  ? "text-blue-700 bg-blue-50/50"
                                  : "text-gray-600 hover:bg-gray-50"
                              }`}
                            >
                              <MapPin className="h-3 w-3 shrink-0 text-gray-400" />
                              <span className="truncate text-left flex-1">{t.name}</span>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {(!bygninger || (bygninger as unknown[]).length === 0) && (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <Building2 className="h-8 w-8 text-gray-300" />
                  <p className="text-sm text-gray-400">Ingen lokasjoner</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
