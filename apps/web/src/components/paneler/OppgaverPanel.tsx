"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { SearchInput, Spinner } from "@sitedoc/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";

const statusGrupper = [
  { id: "alle", labelKey: "status.alle", farge: "bg-gray-500" },
  { id: "draft", labelKey: "status.utkast", farge: "bg-gray-400" },
  { id: "sent", labelKey: "status.sendt", farge: "bg-blue-500" },
  { id: "received", labelKey: "status.mottatt", farge: "bg-indigo-500" },
  { id: "in_progress", labelKey: "status.underArbeid", farge: "bg-yellow-500" },
  { id: "responded", labelKey: "status.besvart", farge: "bg-purple-500" },
  { id: "approved", labelKey: "status.godkjent", farge: "bg-green-500" },
  { id: "rejected", labelKey: "status.avvist", farge: "bg-red-500" },
  { id: "cancelled", labelKey: "status.avbrutt", farge: "bg-red-400" },
  { id: "closed", labelKey: "status.lukket", farge: "bg-gray-600" },
];

const prioritetsGrupper = [
  { id: "critical", labelKey: "prioritet.kritisk", farge: "bg-red-600" },
  { id: "high", labelKey: "prioritet.hoey", farge: "bg-orange-500" },
  { id: "medium", labelKey: "prioritet.middels", farge: "bg-yellow-500" },
  { id: "low", labelKey: "prioritet.lav", farge: "bg-green-500" },
];

export function OppgaverPanel() {
  const params = useParams<{ prosjektId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const aktivStatus = searchParams.get("status") ?? "alle";
  const [sok, setSok] = useState("");
  const { t } = useTranslation();

  const { data: oppgaver, isLoading } =
    trpc.oppgave.hentForProsjekt.useQuery(
      { projectId: params.prosjektId },
      { enabled: !!params.prosjektId },
    ) as { data: Array<{ status: string; priority: string; title: string }> | undefined; isLoading: boolean };

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
        placeholder={t("oppgaver.sokPlaceholder")}
      />

      {/* Status */}
      <div>
        <p className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-gray-400">
          {t("tabell.status")}
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
                  <span>{t(gruppe.labelKey)}</span>
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
          {t("tabell.prioritet")}
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
                  <span>{t(gruppe.labelKey)}</span>
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
