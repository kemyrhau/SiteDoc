"use client";

import { trpc } from "@/lib/trpc";

interface NsKodePanelProps {
  nsKode: string | null;
  prosjektId: string;
}

export function NsKodePanel({ nsKode, prosjektId }: NsKodePanelProps) {
  // Søk i NS 3420-dokumenter (tekst-søk)
  const { data: standardChunks } = trpc.ftdSok.nsStandardSok.useQuery(
    { projectId: prosjektId, nsKode: nsKode! },
    { enabled: !!nsKode && !!prosjektId },
  );

  // Fallback: søk i nsCode-felt (fra GAB/budsjett-import)
  const { data: nsChunks } = trpc.ftdSok.nsChunks.useQuery(
    { nsCode: nsKode! },
    { enabled: !!nsKode && (!standardChunks || standardChunks.length === 0) },
  );

  if (!nsKode) {
    return (
      <div className="text-sm text-gray-400">
        Velg en post med NS-kode for å se kontekst.
      </div>
    );
  }

  const chunks = standardChunks && standardChunks.length > 0 ? standardChunks : nsChunks;
  const erStandard = standardChunks && standardChunks.length > 0;

  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold text-gray-800">
        NS-kode: {nsKode}
        {erStandard && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">NS 3420</span>}
      </div>
      {chunks && chunks.length > 0 ? (
        <div className="max-h-60 space-y-2 overflow-y-auto">
          {chunks.map((chunk) => (
            <div key={chunk.id} className="rounded border border-gray-200 bg-gray-50 p-2">
              <div className="mb-1 text-xs font-medium text-gray-600">
                {"filename" in chunk ? chunk.filename : (chunk as { document: { filename: string } }).document.filename}
                {"pageNumber" in chunk && chunk.pageNumber ? ` · side ${chunk.pageNumber}` : ""}
              </div>
              <div className="whitespace-pre-wrap text-xs leading-relaxed text-gray-700">
                {("chunkText" in chunk ? chunk.chunkText : (chunk as { chunkText: string }).chunkText).slice(0, 300)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-gray-500">
          Ingen NS-kontekst funnet i dokumenter.
        </div>
      )}
    </div>
  );
}
