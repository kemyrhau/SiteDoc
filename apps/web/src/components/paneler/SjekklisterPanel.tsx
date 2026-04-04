"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { SearchInput, Spinner } from "@sitedoc/ui";
import { useState } from "react";
import { useBygning } from "@/kontekst/bygning-kontekst";
import { useTranslation } from "react-i18next";
import { MapPin, X } from "lucide-react";

interface StatusGruppe {
  id: string;
  labelKey: string;
  farge: string;
}

const statusGrupper: StatusGruppe[] = [
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

export function SjekklisterPanel() {
  const params = useParams<{ prosjektId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const aktivStatus = searchParams.get("status") ?? "alle";
  const [sok, setSok] = useState("");
  const { aktivBygning, standardTegning, settStandardTegning } = useBygning();
  const { t } = useTranslation();

  const { data: sjekklister, isLoading } =
    trpc.sjekkliste.hentForProsjekt.useQuery(
      { projectId: params.prosjektId },
      { enabled: !!params.prosjektId },
    );

  function tellForStatus(statusId: string): number {
    if (!sjekklister) return 0;
    if (statusId === "alle") return sjekklister.length;
    return sjekklister.filter((s: { status: string }) => s.status === statusId).length;
  }

  function velgStatus(statusId: string) {
    const url = `/dashbord/${params.prosjektId}/sjekklister${statusId !== "alle" ? `?status=${statusId}` : ""}`;
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
    <div className="flex flex-col gap-3">
      <SearchInput
        verdi={sok}
        onChange={setSok}
        placeholder={t("sjekklister.sokPlaceholder")}
      />

      {/* Standard-tegning for opprettelse */}
      {standardTegning && (
        <div className="rounded-md border border-blue-100 bg-blue-50/50 px-2.5 py-1.5">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-blue-400">
            Standard tegning
          </p>
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-blue-500" />
            <span className="flex-1 truncate text-xs font-medium text-blue-700">
              {aktivBygning ? `${aktivBygning.name} — ` : ""}{standardTegning.name}
            </span>
            <button
              onClick={() => settStandardTegning(null)}
              className="rounded p-0.5 text-blue-400 hover:bg-blue-100 hover:text-blue-600"
              title={t("handling.fjern")}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

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
  );
}
