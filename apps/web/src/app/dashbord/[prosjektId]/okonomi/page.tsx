"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { EntrepriseVelger } from "@/components/mengde/entreprise-velger";
import { PeriodeVelger } from "@/components/mengde/periode-velger";
import { SpecPostTabell } from "@/components/mengde/spec-post-tabell";
import { Avviksanalyse } from "@/components/mengde/avviksanalyse";
import { NotatEditor } from "@/components/mengde/notat-editor";
import { NsKodePanel } from "@/components/mengde/ns-kode-panel";
import { trpc } from "@/lib/trpc";

type Fane = "oversikt" | "avviksanalyse";

export default function OkonomiSide() {
  const params = useParams<{ prosjektId: string }>();
  const prosjektId = params.prosjektId;

  const [enterpriseId, setEnterpriseId] = useState<string | null>(null);
  const [periodId, setPeriodId] = useState<string | null>(null);
  const [aktivFane, setAktivFane] = useState<Fane>("oversikt");
  const [valgtPostId, setValgtPostId] = useState<string | null>(null);

  const { data: poster } = trpc.mengde.hentSpecPoster.useQuery(
    { projectId: prosjektId, periodId: periodId ?? undefined },
    { enabled: !!prosjektId },
  );

  const valgtPost = poster?.find((p) => p.id === valgtPostId) ?? null;

  return (
    <div className="flex h-full flex-col">
      {/* Toppseksjon */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-sitedoc-primary" />
          <h1 className="text-lg font-semibold">Økonomi</h1>
        </div>
      </div>

      {/* Velgere */}
      <div className="flex items-center gap-3 border-b px-4 py-2">
        <label className="text-xs text-gray-500">Entreprise:</label>
        <EntrepriseVelger
          projectId={prosjektId}
          value={enterpriseId}
          onChange={(id) => {
            setEnterpriseId(id);
            setPeriodId(null);
          }}
        />
        <label className="text-xs text-gray-500">Periode:</label>
        <PeriodeVelger
          projectId={prosjektId}
          enterpriseId={enterpriseId}
          value={periodId}
          onChange={setPeriodId}
        />
      </div>

      {/* Faner */}
      <div className="flex gap-1 border-b px-4">
        <FaneKnapp
          aktiv={aktivFane === "oversikt"}
          onClick={() => setAktivFane("oversikt")}
        >
          Oversikt
        </FaneKnapp>
        <FaneKnapp
          aktiv={aktivFane === "avviksanalyse"}
          onClick={() => setAktivFane("avviksanalyse")}
        >
          Avviksanalyse
        </FaneKnapp>
      </div>

      {/* Innhold */}
      <div className="flex-1 overflow-auto p-4">
        {aktivFane === "oversikt" ? (
          <div className="space-y-4">
            <SpecPostTabell
              projectId={prosjektId}
              periodId={periodId}
              onVelgPost={setValgtPostId}
              valgtPostId={valgtPostId}
            />

            {valgtPostId && (
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded border p-3">
                  <NotatEditor
                    specPostId={valgtPostId}
                    eksternNotat={valgtPost?.eksternNotat ?? null}
                  />
                </div>
                <div className="rounded border p-3">
                  <NsKodePanel nsKode={valgtPost?.nsKode ?? null} />
                </div>
              </div>
            )}
          </div>
        ) : (
          <Avviksanalyse projectId={prosjektId} />
        )}
      </div>
    </div>
  );
}

function FaneKnapp({
  aktiv,
  onClick,
  children,
}: {
  aktiv: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
        aktiv
          ? "border-sitedoc-primary text-sitedoc-primary"
          : "border-transparent text-gray-500 hover:text-gray-700"
      }`}
    >
      {children}
    </button>
  );
}
