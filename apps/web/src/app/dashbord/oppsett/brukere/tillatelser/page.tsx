"use client";

import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { trpc } from "@/lib/trpc";
import { Spinner } from "@sitedoc/ui";
import { Check, Minus, Lock } from "lucide-react";
import {
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  utvidTillatelser,
  type Permission,
} from "@sitedoc/shared";

/* ------------------------------------------------------------------ */
/*  Typer                                                              */
/* ------------------------------------------------------------------ */

interface GruppeData {
  id: string;
  name: string;
  slug: string;
  permissions: unknown;
}

/* ------------------------------------------------------------------ */
/*  Hjelpefunksjoner                                                   */
/* ------------------------------------------------------------------ */

function hentGruppeTillatelser(gruppe: GruppeData): Set<Permission> {
  const raaTillatelser = (gruppe.permissions as string[]) ?? [];
  return utvidTillatelser(raaTillatelser);
}

/** Bestem modus for en tillatelsesgruppe: "rediger" | "les" | "ingen" */
function hentModus(
  gruppeTillatelser: Set<Permission>,
  tillatelsesGruppe: { permissions: Permission[] },
): "rediger" | "les" | "ingen" {
  const perms = tillatelsesGruppe.permissions;

  // Hvis gruppen kun har én tillatelse (f.eks. template_manage) — enten rediger eller ingen
  if (perms.length === 1 && perms[0]) {
    return gruppeTillatelser.has(perms[0]) ? "rediger" : "ingen";
  }

  const harEdit = perms.some((p) => (p.endsWith("_edit") || p.endsWith("_manage")) && gruppeTillatelser.has(p));
  if (harEdit) return "rediger";

  const harView = perms.some((p) => p.endsWith("_view") && gruppeTillatelser.has(p));
  if (harView) return "les";

  return "ingen";
}

/* ------------------------------------------------------------------ */
/*  Moduscelle                                                         */
/* ------------------------------------------------------------------ */

function ModusCelle({ modus }: { modus: "rediger" | "les" | "ingen" }) {
  if (modus === "rediger") {
    return (
      <div className="flex items-center justify-center">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100">
          <Check className="h-3.5 w-3.5 text-emerald-600" />
        </div>
      </div>
    );
  }
  if (modus === "les") {
    return (
      <div className="flex items-center justify-center">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100">
          <Minus className="h-3.5 w-3.5 text-blue-600" />
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center">
      <div className="h-6 w-6" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Hovedside                                                          */
/* ------------------------------------------------------------------ */

export default function TillatelserSide() {
  const { prosjektId } = useProsjekt();

  const { data: grupper, isLoading } = trpc.gruppe.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );

  if (!prosjektId) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-gray-400">
        Velg et prosjekt for å se tillatelser
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  const prosjektGrupper = (grupper ?? []) as unknown as GruppeData[];

  // Filtrer til field-grupper (de som har tillatelser)
  const fieldGrupper = prosjektGrupper.filter((g) => {
    const perms = (g.permissions as string[]) ?? [];
    return perms.length > 0;
  });

  if (fieldGrupper.length === 0) {
    return (
      <div>
        <h1 className="mb-4 text-lg font-semibold text-gray-900">Tillatelser</h1>
        <p className="text-sm text-gray-500">
          Ingen brukergrupper med tillatelser funnet. Opprett standardgrupper på brukersiden.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Tillatelser</h1>
        <div className="flex items-center gap-1.5 rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
          <Lock className="h-3.5 w-3.5" />
          Tillatelser styres globalt av SiteDoc-administrator
        </div>
      </div>

      {/* Forklaring */}
      <div className="mb-4 flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100">
            <Check className="h-3 w-3 text-emerald-600" />
          </span>
          Rediger
        </span>
        <span className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100">
            <Minus className="h-3 w-3 text-blue-600" />
          </span>
          Kun les
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-5 w-5" />
          Ingen tilgang
        </span>
      </div>

      {/* Matrise */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                Funksjon
              </th>
              {fieldGrupper.map((gruppe) => (
                <th
                  key={gruppe.id}
                  className="px-3 py-3 text-center font-medium text-gray-600"
                  style={{ minWidth: 120 }}
                >
                  <div className="truncate">{gruppe.name}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_GROUPS.map((pg, idx) => {
              return (
                <tr
                  key={pg.label}
                  className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}
                >
                  <td className="px-4 py-2.5 font-medium text-gray-700">
                    {pg.label}
                  </td>
                  {fieldGrupper.map((gruppe) => {
                    const gruppeTillatelser = hentGruppeTillatelser(gruppe);
                    const modus = hentModus(gruppeTillatelser, pg);
                    return (
                      <td key={gruppe.id} className="px-3 py-2.5">
                        <ModusCelle modus={modus} />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
