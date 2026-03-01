"use client";

import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { SearchInput, Spinner } from "@siteflow/ui";
import { useState } from "react";
import { FileText } from "lucide-react";

export function MalerPanel() {
  const params = useParams<{ prosjektId: string }>();
  const router = useRouter();
  const [sok, setSok] = useState("");

  const { data: maler, isLoading } = trpc.mal.hentForProsjekt.useQuery(
    { projectId: params.prosjektId },
    { enabled: !!params.prosjektId },
  );

  const filtrerte = (maler ?? []).filter((m) =>
    m.name.toLowerCase().includes(sok.toLowerCase()),
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
      <SearchInput verdi={sok} onChange={setSok} placeholder="Søk maler..." />
      <div className="flex flex-col gap-0.5">
        {filtrerte.length === 0 ? (
          <p className="px-2 py-2 text-sm text-gray-400">Ingen maler funnet</p>
        ) : (
          filtrerte.map((mal) => (
            <button
              key={mal.id}
              onClick={() =>
                router.push(
                  `/dashbord/${params.prosjektId}/maler/${mal.id}`,
                )
              }
              className="flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50"
            >
              <FileText className="h-4 w-4 flex-shrink-0 text-gray-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{mal.name}</p>
                <p className="text-xs text-gray-400">
                  {mal._count.objects} objekter &middot;{" "}
                  {mal._count.checklists} sjekklister
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
