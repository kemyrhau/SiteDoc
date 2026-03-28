"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { BarChart3, Upload, FileText, Trash2 } from "lucide-react";
import { EntrepriseVelger } from "@/components/mengde/entreprise-velger";
import { PeriodeVelger } from "@/components/mengde/periode-velger";
import { SpecPostTabell } from "@/components/mengde/spec-post-tabell";
import { Avviksanalyse } from "@/components/mengde/avviksanalyse";
import { NotatEditor } from "@/components/mengde/notat-editor";
import { NsKodePanel } from "@/components/mengde/ns-kode-panel";
import { ImportDialog } from "@/components/mengde/import-dialog";
import { trpc } from "@/lib/trpc";

type Fane = "oversikt" | "avviksanalyse" | "dokumenter";

export default function OkonomiSide() {
  const params = useParams<{ prosjektId: string }>();
  const prosjektId = params.prosjektId;

  const [enterpriseId, setEnterpriseId] = useState<string | null>(null);
  const [periodId, setPeriodId] = useState<string | null>(null);
  const [aktivFane, setAktivFane] = useState<Fane>("oversikt");
  const [valgtPostId, setValgtPostId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const { data: dokumenter } = trpc.mengde.hentDokumenter.useQuery(
    { projectId: prosjektId },
    { enabled: !!prosjektId },
  );

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
        <button
          onClick={() => setImportOpen(true)}
          className="flex items-center gap-1.5 rounded bg-sitedoc-primary px-3 py-1.5 text-sm text-white hover:bg-sitedoc-secondary"
        >
          <Upload className="h-4 w-4" />
          Importer
        </button>
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
        <FaneKnapp
          aktiv={aktivFane === "dokumenter"}
          onClick={() => setAktivFane("dokumenter")}
        >
          Dokumenter
          {dokumenter && dokumenter.length > 0 && (
            <span className="ml-1.5 rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px]">
              {dokumenter.length}
            </span>
          )}
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
        ) : aktivFane === "avviksanalyse" ? (
          <Avviksanalyse projectId={prosjektId} />
        ) : (
          <DokumentListe
            dokumenter={dokumenter ?? []}
            projectId={prosjektId}
          />
        )}
      </div>

      <ImportDialog
        projectId={prosjektId}
        open={importOpen}
        onClose={() => setImportOpen(false)}
      />
    </div>
  );
}

function DokumentListe({
  dokumenter,
  projectId,
}: {
  dokumenter: Array<{
    id: string;
    filename: string;
    docType: string | null;
    uploadedAt: string | Date;
    folder: { id: string; name: string } | null;
  }>;
  projectId: string;
}) {
  const utils = trpc.useUtils();
  const slettMutation = trpc.mengde.slettDokument.useMutation({
    onSuccess: () => utils.mengde.hentDokumenter.invalidate({ projectId }),
  });

  const DOC_TYPE_LABEL: Record<string, string> = {
    budsjett: "Budsjett",
    a_nota: "A-nota",
    t_nota: "T-nota",
    mengdebeskrivelse: "Mengdebeskrivelse",
    annet: "Dokument",
  };

  if (dokumenter.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <FileText className="mb-2 h-8 w-8" />
        <div className="text-sm">Ingen dokumenter importert ennå.</div>
        <div className="text-xs">Klikk «Importer» for å laste opp.</div>
      </div>
    );
  }

  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b text-xs font-medium uppercase text-gray-500">
          <th className="px-3 py-2">Filnavn</th>
          <th className="px-3 py-2">Type</th>
          <th className="px-3 py-2">Mappe</th>
          <th className="px-3 py-2">Lastet opp</th>
          <th className="px-3 py-2 w-10"></th>
        </tr>
      </thead>
      <tbody>
        {dokumenter.map((dok) => (
          <tr key={dok.id} className="border-b hover:bg-gray-50">
            <td className="px-3 py-2 flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-400 shrink-0" />
              {dok.filename}
            </td>
            <td className="px-3 py-2 text-gray-500">
              {DOC_TYPE_LABEL[dok.docType ?? ""] ?? dok.docType ?? "—"}
            </td>
            <td className="px-3 py-2 text-gray-500">
              {dok.folder?.name ?? "—"}
            </td>
            <td className="px-3 py-2 text-gray-500">
              {new Date(dok.uploadedAt).toLocaleDateString("nb-NO")}
            </td>
            <td className="px-3 py-2">
              <button
                onClick={() => {
                  if (confirm(`Fjern «${dok.filename}»?`)) {
                    slettMutation.mutate({ documentId: dok.id });
                  }
                }}
                className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
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
