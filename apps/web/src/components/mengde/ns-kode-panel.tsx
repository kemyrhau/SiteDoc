"use client";

import { trpc } from "@/lib/trpc";

interface NsKodePanelProps {
  nsKode: string | null;
}

export function NsKodePanel({ nsKode }: NsKodePanelProps) {
  const { data: chunks } = trpc.ftdSok.nsChunks.useQuery(
    { nsCode: nsKode! },
    { enabled: !!nsKode },
  );

  if (!nsKode) {
    return (
      <div className="text-sm text-gray-400">
        Velg en post med NS-kode for å se kontekst.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-gray-500">
        NS-kode: {nsKode}
      </div>
      {chunks && chunks.length > 0 ? (
        <div className="max-h-60 space-y-2 overflow-y-auto">
          {chunks.map((chunk) => (
            <div key={chunk.id} className="rounded border bg-gray-50 p-2">
              <div className="mb-1 text-xs text-gray-500">
                {chunk.document.filename}
                {chunk.pageNumber ? ` · side ${chunk.pageNumber}` : ""}
              </div>
              <div className="whitespace-pre-wrap text-xs leading-relaxed">
                {chunk.chunkText.slice(0, 300)}
                {chunk.chunkText.length > 300 ? "..." : ""}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-gray-400">
          Ingen NS-kontekst funnet i dokumenter.
        </div>
      )}
    </div>
  );
}
