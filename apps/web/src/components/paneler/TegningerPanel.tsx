"use client";

import { SearchInput, Spinner } from "@siteflow/ui";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { useBygning } from "@/kontekst/bygning-kontekst";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Star,
  MapPin,
  Layers,
} from "lucide-react";

interface Tegning {
  id: string;
  name: string;
  drawingNumber: string | null;
  discipline: string | null;
  floor: string | null;
  geoReference: unknown;
}

interface EtasjeGruppe {
  nokkel: string;
  label: string;
  ikon: "utomhus" | "etasje";
  tegninger: Tegning[];
}

const UTOMHUS_NOKKEL = "__utomhus__";
const UTEN_ETASJE_NOKKEL = "__uten_etasje__";

function grupperTegningerIBygning(tegninger: Tegning[]): EtasjeGruppe[] {
  const utomhus: Tegning[] = [];
  const etasjeMap = new Map<string, Tegning[]>();
  const utenEtasje: Tegning[] = [];

  for (const t of tegninger) {
    if (t.geoReference != null) {
      utomhus.push(t);
    } else if (t.floor != null && t.floor.trim() !== "") {
      const eksisterende = etasjeMap.get(t.floor) ?? [];
      eksisterende.push(t);
      etasjeMap.set(t.floor, eksisterende);
    } else {
      utenEtasje.push(t);
    }
  }

  const grupper: EtasjeGruppe[] = [];

  if (utomhus.length > 0) {
    grupper.push({
      nokkel: UTOMHUS_NOKKEL,
      label: "Utomhus",
      ikon: "utomhus",
      tegninger: utomhus,
    });
  }

  // Sorter etasjer naturlig (01, 02, ..., Tak)
  const sorterteEtasjer = [...etasjeMap.keys()].sort((a, b) =>
    a.localeCompare(b, "nb-NO", { numeric: true }),
  );

  for (const etasje of sorterteEtasjer) {
    grupper.push({
      nokkel: etasje,
      label: etasje,
      ikon: "etasje",
      tegninger: etasjeMap.get(etasje)!,
    });
  }

  if (utenEtasje.length > 0) {
    grupper.push({
      nokkel: UTEN_ETASJE_NOKKEL,
      label: "(Uten etasje)",
      ikon: "etasje",
      tegninger: utenEtasje,
    });
  }

  return grupper;
}

function tegningMatcherSok(t: Tegning, sokLower: string): boolean {
  return (
    t.name.toLowerCase().includes(sokLower) ||
    (t.drawingNumber?.toLowerCase().includes(sokLower) ?? false) ||
    (t.discipline?.toLowerCase().includes(sokLower) ?? false)
  );
}

function tegningVisningstekst(t: Tegning): string {
  return t.drawingNumber || t.name;
}

export function TegningerPanel() {
  const params = useParams<{ prosjektId: string }>();
  const [sok, setSok] = useState("");
  const [utvidede, setUtvidede] = useState<Set<string>>(new Set());
  const { aktivBygning, velgBygning, standardTegning, settStandardTegning } =
    useBygning();

  const { data: bygninger, isLoading } =
    trpc.bygning.hentForProsjekt.useQuery(
      { projectId: params.prosjektId },
      { enabled: !!params.prosjektId },
    );

  function toggleUtvid(nokkel: string) {
    setUtvidede((prev) => {
      const ny = new Set(prev);
      if (ny.has(nokkel)) {
        ny.delete(nokkel);
      } else {
        ny.add(nokkel);
      }
      return ny;
    });
  }

  function handleVelgBygning(bygning: {
    id: string;
    name: string;
    number: number | null;
  }) {
    if (aktivBygning?.id === bygning.id) {
      velgBygning(null);
    } else {
      velgBygning(bygning);
      setUtvidede((prev) => new Set(prev).add(bygning.id));
    }
  }

  function handleVelgTegning(
    tegning: { id: string; name: string },
    bygningId: string,
  ) {
    if (standardTegning?.id === tegning.id) {
      settStandardTegning(null);
    } else {
      settStandardTegning(tegning);
    }
    if (aktivBygning?.id !== bygningId) {
      const byg = bygninger?.find((b) => b.id === bygningId);
      if (byg) {
        velgBygning({ id: byg.id, name: byg.name, number: byg.number });
        setUtvidede((prev) => new Set(prev).add(bygningId));
      }
    }
  }

  const sokLower = sok.toLowerCase();

  // Filtrer bygninger og grupper basert på søk
  const filtrerte = useMemo(() => {
    if (!bygninger) return [];
    return bygninger
      .map((bygning) => {
        const bygningMatch =
          !sok ||
          bygning.name.toLowerCase().includes(sokLower) ||
          (bygning.number && String(bygning.number).includes(sok));

        const filtrerTegninger = sok
          ? (bygning.drawings as Tegning[]).filter((t) =>
              tegningMatcherSok(t, sokLower),
            )
          : (bygning.drawings as Tegning[]);

        if (!bygningMatch && filtrerTegninger.length === 0) return null;

        const grupper = grupperTegningerIBygning(filtrerTegninger);
        return { ...bygning, filtrerteGrupper: grupper };
      })
      .filter(Boolean) as (typeof bygninger[number] & {
      filtrerteGrupper: EtasjeGruppe[];
    })[];
  }, [bygninger, sok, sokLower]);

  // Auto-utvid aktiv bygning og etasje med standardtegning
  if (aktivBygning && !utvidede.has(aktivBygning.id)) {
    const finnes = filtrerte.some((b) => b.id === aktivBygning.id);
    if (finnes) {
      setUtvidede((prev) => new Set(prev).add(aktivBygning.id));
    }
  }

  // Auto-utvid etasje som inneholder standardtegning
  if (standardTegning && aktivBygning) {
    const bygning = filtrerte.find((b) => b.id === aktivBygning.id);
    if (bygning) {
      for (const gruppe of bygning.filtrerteGrupper) {
        const etasjeNokkel = `${bygning.id}::${gruppe.nokkel}`;
        if (
          gruppe.tegninger.some((t) => t.id === standardTegning.id) &&
          !utvidede.has(etasjeNokkel)
        ) {
          setUtvidede((prev) => new Set(prev).add(etasjeNokkel));
        }
      }
    }
  }

  // Auto-utvid bygninger med kun 1 etasjegruppe
  for (const bygning of filtrerte) {
    if (
      utvidede.has(bygning.id) &&
      bygning.filtrerteGrupper.length === 1
    ) {
      const etasjeNokkel = `${bygning.id}::${bygning.filtrerteGrupper[0].nokkel}`;
      if (!utvidede.has(etasjeNokkel)) {
        setUtvidede((prev) => new Set(prev).add(etasjeNokkel));
      }
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Spinner size="sm" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <SearchInput
        verdi={sok}
        onChange={setSok}
        placeholder="Søk lokasjoner..."
      />

      <div className="flex flex-col gap-0.5">
        {/* Alle lokasjoner */}
        <button
          onClick={() => velgBygning(null)}
          className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
            !aktivBygning
              ? "bg-blue-50 text-blue-700 font-medium"
              : "text-gray-700 hover:bg-gray-50"
          }`}
        >
          <MapPin className="h-4 w-4 shrink-0" />
          <span>Alle lokasjoner</span>
        </button>

        {/* Bygningsliste */}
        {filtrerte.map((bygning) => {
          const erAktiv = aktivBygning?.id === bygning.id;
          const erUtvidet = utvidede.has(bygning.id);
          const antallTegninger = bygning._count.drawings;

          return (
            <div key={bygning.id}>
              {/* Bygning-header */}
              <button
                onClick={() =>
                  handleVelgBygning({
                    id: bygning.id,
                    name: bygning.name,
                    number: bygning.number,
                  })
                }
                className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors ${
                  erAktiv
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span
                  role="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleUtvid(bygning.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.stopPropagation();
                      toggleUtvid(bygning.id);
                    }
                  }}
                  className="shrink-0 p-0.5 rounded hover:bg-gray-200"
                >
                  {erUtvidet ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </span>
                <Building2 className="h-4 w-4 shrink-0" />
                <span className="truncate text-left flex-1">
                  {bygning.number ? `${bygning.number}. ` : ""}
                  {bygning.name}
                </span>
                <span className="text-xs text-gray-400 shrink-0">
                  ({antallTegninger})
                </span>
              </button>

              {/* Etasjegrupper */}
              {erUtvidet && bygning.filtrerteGrupper.length > 0 && (
                <div className="ml-6 flex flex-col gap-0.5 mt-0.5">
                  {bygning.filtrerteGrupper.map((gruppe) => {
                    const etasjeNokkel = `${bygning.id}::${gruppe.nokkel}`;
                    const erEtasjeUtvidet = utvidede.has(etasjeNokkel);

                    return (
                      <div key={gruppe.nokkel}>
                        {/* Etasje-header */}
                        <button
                          onClick={() => toggleUtvid(etasjeNokkel)}
                          className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
                        >
                          {erEtasjeUtvidet ? (
                            <ChevronDown className="h-3 w-3 shrink-0" />
                          ) : (
                            <ChevronRight className="h-3 w-3 shrink-0" />
                          )}
                          {gruppe.ikon === "utomhus" ? (
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                          ) : (
                            <Layers className="h-3.5 w-3.5 shrink-0" />
                          )}
                          <span className="truncate text-left flex-1 font-medium">
                            {gruppe.label}
                          </span>
                          <span className="text-xs text-gray-400 shrink-0">
                            ({gruppe.tegninger.length})
                          </span>
                        </button>

                        {/* Tegninger i etasjegruppen */}
                        {erEtasjeUtvidet && (
                          <div className="ml-5 flex flex-col gap-0.5 mt-0.5">
                            {gruppe.tegninger.map((tegning) => {
                              const erStandard =
                                standardTegning?.id === tegning.id;
                              return (
                                <button
                                  key={tegning.id}
                                  onClick={() =>
                                    handleVelgTegning(tegning, bygning.id)
                                  }
                                  className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors ${
                                    erStandard
                                      ? "text-blue-700 bg-blue-50/50"
                                      : "text-gray-600 hover:bg-gray-50"
                                  }`}
                                >
                                  {erStandard ? (
                                    <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
                                  ) : (
                                    <span className="w-3 shrink-0" />
                                  )}
                                  <span className="truncate text-left flex-1">
                                    {tegningVisningstekst(tegning)}
                                  </span>
                                  {tegning.discipline && (
                                    <span className="text-[10px] text-gray-400 bg-gray-100 rounded px-1 shrink-0">
                                      {tegning.discipline}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {erUtvidet && bygning.filtrerteGrupper.length === 0 && (
                <div className="ml-6 px-2 py-1 text-xs text-gray-400">
                  Ingen tegninger
                </div>
              )}
            </div>
          );
        })}

        {filtrerte.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Building2 className="h-8 w-8 text-gray-300" />
            <p className="text-sm text-gray-400">
              {sok ? "Ingen treff" : "Ingen lokasjoner"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
