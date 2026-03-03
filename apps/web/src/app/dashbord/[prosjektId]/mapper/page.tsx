"use client";

import { useSearchParams } from "next/navigation";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { trpc } from "@/lib/trpc";
import { Spinner, Table } from "@siteflow/ui";
import { FolderOpen, FileText, Download } from "lucide-react";

export default function MapperSide() {
  const { prosjektId } = useProsjekt();
  const searchParams = useSearchParams();
  const valgtMappeId = searchParams.get("mappe");

  // Hent alle mapper for å finne valgt mappes navn
  const { data: mapper } = trpc.mappe.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );

  // Hent dokumenter for valgt mappe
  const { data: dokumenter, isLoading: lasterDokumenter } =
    trpc.mappe.hentDokumenter.useQuery(
      { folderId: valgtMappeId! },
      { enabled: !!valgtMappeId },
    );

  const valgtMappe = mapper?.find((m) => m.id === valgtMappeId);

  // Ingen mappe valgt — vis velkomstmelding
  if (!valgtMappeId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-20">
        <FolderOpen className="mb-3 h-12 w-12 text-gray-300" />
        <h2 className="mb-1 text-lg font-semibold text-gray-700">Mapper</h2>
        <p className="text-sm text-gray-400">
          Velg en mappe i panelet til venstre for å se innholdet.
        </p>
      </div>
    );
  }

  if (lasterDokumenter) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  type DokumentRad = {
    id: string;
    name: string;
    fileUrl: string;
    version: number;
    createdAt: string;
  };

  return (
    <div>
      <div className="mb-6 flex items-center gap-2">
        <FolderOpen className="h-5 w-5 text-amber-500" />
        <h2 className="text-xl font-bold text-gray-900">
          {valgtMappe?.name ?? "Mappe"}
        </h2>
      </div>

      {!dokumenter?.length ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
          <FileText className="mx-auto mb-2 h-10 w-10 text-gray-300" />
          <p className="text-sm text-gray-500">
            Denne mappen er tom.
          </p>
        </div>
      ) : (
        <Table<DokumentRad>
          kolonner={[
            {
              id: "name",
              header: "Navn",
              celle: (rad) => (
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 flex-shrink-0 text-gray-400" />
                  <span className="font-medium text-gray-900">{rad.name}</span>
                </div>
              ),
            },
            {
              id: "version",
              header: "Versjon",
              celle: (rad) => (
                <span className="text-sm text-gray-500">v{rad.version}</span>
              ),
              bredde: "80px",
            },
            {
              id: "createdAt",
              header: "Opprettet",
              celle: (rad) => (
                <span className="text-sm text-gray-500">
                  {new Date(rad.createdAt).toLocaleDateString("nb-NO")}
                </span>
              ),
              bredde: "120px",
            },
            {
              id: "download",
              header: "",
              celle: (rad) => (
                <a
                  href={rad.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  title="Last ned"
                >
                  <Download className="h-4 w-4" />
                </a>
              ),
              bredde: "50px",
            },
          ]}
          data={(dokumenter ?? []) as DokumentRad[]}
          radNokkel={(rad) => rad.id}
        />
      )}
    </div>
  );
}
