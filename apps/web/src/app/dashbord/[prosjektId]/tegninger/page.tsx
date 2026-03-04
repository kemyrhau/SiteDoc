"use client";

import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { useBygning } from "@/kontekst/bygning-kontekst";
import { Spinner } from "@siteflow/ui";
import { Map, FileText } from "lucide-react";

export default function TegningerSide() {
  const params = useParams<{ prosjektId: string }>();
  const { standardTegning, aktivBygning } = useBygning();

  const { data: tegning, isLoading } = trpc.tegning.hentMedId.useQuery(
    { id: standardTegning?.id ?? "" },
    { enabled: !!standardTegning?.id },
  );

  // Ingen tegning valgt
  if (!standardTegning) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <Map className="mx-auto mb-4 h-16 w-16 text-gray-200" />
          <p className="text-lg font-medium text-gray-400">
            {aktivBygning
              ? "Velg en tegning i panelet"
              : "Velg en lokasjon og tegning i panelet"}
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!tegning) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-gray-400">Tegningen ble ikke funnet</p>
      </div>
    );
  }

  const fileUrl = tegning.fileUrl ? `/api${tegning.fileUrl}` : null;
  const fileType = tegning.fileType ?? "";
  const erBilde = ["png", "jpg", "jpeg"].includes(fileType);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header med tegningsnavn */}
      <div className="flex items-center gap-2 border-b border-gray-200 bg-white px-6 py-3">
        <FileText className="h-4 w-4 text-gray-400" />
        <span className="text-sm font-medium text-gray-900">
          {tegning.name}
        </span>
        {tegning.drawingNumber && (
          <span className="text-sm text-gray-500">
            ({tegning.drawingNumber})
          </span>
        )}
        {tegning.revision && (
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
            Rev. {tegning.revision}
          </span>
        )}
      </div>

      {/* Tegningsvisning */}
      {fileUrl ? (
        erBilde ? (
          <div className="flex-1 overflow-auto bg-gray-50">
            <img
              src={fileUrl}
              alt={tegning.name}
              className="w-full"
              crossOrigin="anonymous"
            />
          </div>
        ) : (
          <iframe
            src={fileUrl}
            title={tegning.name}
            className="flex-1 border-0"
          />
        )
      ) : (
        <div className="flex flex-1 items-center justify-center bg-gray-50">
          <p className="text-gray-400">Ingen fil tilgjengelig</p>
        </div>
      )}
    </div>
  );
}
