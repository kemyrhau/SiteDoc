"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { SearchInput, Spinner } from "@siteflow/ui";
import { useState } from "react";

const statusGrupper = [
  { id: "alle", label: "Alle", farge: "bg-gray-500" },
  { id: "draft", label: "Utkast", farge: "bg-gray-400" },
  { id: "sent", label: "Sendt", farge: "bg-blue-500" },
  { id: "in_progress", label: "Under arbeid", farge: "bg-yellow-500" },
  { id: "responded", label: "Besvart", farge: "bg-purple-500" },
  { id: "approved", label: "Godkjent", farge: "bg-green-500" },
  { id: "rejected", label: "Avvist", farge: "bg-red-500" },
  { id: "closed", label: "Lukket", farge: "bg-gray-600" },
];

const prioritetsGrupper = [
  { id: "critical", label: "Kritisk", farge: "bg-red-600" },
  { id: "high", label: "Høy", farge: "bg-orange-500" },
  { id: "medium", label: "Medium", farge: "bg-yellow-500" },
  { id: "low", label: "Lav", farge: "bg-green-500" },
];

export function OppgaverPanel() {
  const params = useParams<{ prosjektId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const aktivStatus = searchParams.get("status") ?? "alle";
  const [sok, setSok] = useState("");

  const { data: oppgaver, isLoading } =
    trpc.oppgave.hentForProsjekt.useQuery(
      { projectId: params.prosjektId },
      { enabled: !!params.prosjektId },
    );

  function tellForStatus(statusId: string): number {
    if (!oppgaver) return 0;
    if (statusId === "alle") return oppgaver.length;
    return oppgaver.filter((o) => o.status === statusId).length;
  }

  function tellForPrioritet(prioritetId: string): number {
    if (!oppgaver) return 0;
    return oppgaver.filter((o) => o.priority === prioritetId).length;
  }

  function velgStatus(statusId: string) {
    const url = `/dashbord/${params.prosjektId}/oppgaver${statusId !== "alle" ? `?status=${statusId}` : ""}`;
    router.push(url);
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Spinner size="sm" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <SearchInput
        verdi={sok}
        onChange={setSok}
        placeholder="Søk oppgaver..."
      />

      {/* Status */}
      <div>
        <p className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-gray-400">
          Status
        </p>
        <div className="flex flex-col gap-0.5">
          {statusGrupper.map((gruppe) => {
            const antall = tellForStatus(gruppe.id);
            return (
              <button
                key={gruppe.id}
                onClick={() => velgStatus(gruppe.id)}
                className={`flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors ${
                  aktivStatus === gruppe.id
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${gruppe.farge}`} />
                  <span>{gruppe.label}</span>
                </div>
                <span className="text-xs text-gray-400">{antall}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Prioritet */}
      <div>
        <p className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-gray-400">
          Prioritet
        </p>
        <div className="flex flex-col gap-0.5">
          {prioritetsGrupper.map((gruppe) => {
            const antall = tellForPrioritet(gruppe.id);
            return (
              <div
                key={gruppe.id}
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm text-gray-700"
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${gruppe.farge}`} />
                  <span>{gruppe.label}</span>
                </div>
                <span className="text-xs text-gray-400">{antall}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
