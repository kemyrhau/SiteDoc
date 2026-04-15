"use client";

import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { SearchInput, Spinner } from "@sitedoc/ui";
import { useState } from "react";
import { Building2, Star } from "lucide-react";

export function EntrepriserPanel() {
  const params = useParams<{ prosjektId: string }>();
  const [sok, setSok] = useState("");

  const { data: entrepriser, isLoading } =
    trpc.entreprise.hentForProsjekt.useQuery(
      { projectId: params.prosjektId },
      { enabled: !!params.prosjektId },
    );

  const filtrerte = (entrepriser ?? []).filter((e) =>
    e.name.toLowerCase().includes(sok.toLowerCase()),
  );

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
        placeholder="Søk entrepriser..."
      />
      <div className="flex flex-col gap-0.5">
        {filtrerte.length === 0 ? (
          <p className="px-2 py-2 text-sm text-gray-400">
            Ingen entrepriser funnet
          </p>
        ) : (
          filtrerte.map((ent) => {
            const ansvarlig = (ent as { ansvarlig?: { id: string; name: string | null; email: string } | null }).ansvarlig;
            return (
              <div
                key={ent.id}
                className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-gray-700"
              >
                <Building2 className="h-4 w-4 flex-shrink-0 text-gray-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{ent.name}</p>
                  <p className="text-xs text-gray-400">
                    {ent.dokumentflytKoblinger.length} medlemmer
                    {ansvarlig && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5">
                        <Star className="inline h-3 w-3 fill-amber-400 text-amber-400" />
                        {ansvarlig.name ?? ansvarlig.email}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
