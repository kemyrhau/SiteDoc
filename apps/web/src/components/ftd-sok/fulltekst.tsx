"use client";

import { trpc } from "@/lib/trpc";

interface FulltekstProps {
  documentId: string | null;
}

export function Fulltekst({ documentId }: FulltekstProps) {
  const { data: chunks, isLoading } = trpc.ftdSok.hentDokumentChunks.useQuery(
    { documentId: documentId! },
    { enabled: !!documentId },
  );

  if (!documentId) {
    return (
      <div className="text-sm text-gray-400">
        Velg et treff for å se fulltekst.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="text-sm text-gray-400">Laster dokumentinnhold...</div>
    );
  }

  if (!chunks || chunks.length === 0) {
    return <div className="text-sm text-gray-400">Ingen innhold funnet.</div>;
  }

  return (
    <div className="max-h-[60vh] space-y-3 overflow-y-auto">
      {chunks.map((chunk) => (
        <div key={chunk.id} className="border-b pb-2">
          <div className="mb-1 flex items-center gap-2 text-xs text-gray-400">
            {chunk.pageNumber && <span>Side {chunk.pageNumber}</span>}
            {chunk.sectionTitle && <span>· {chunk.sectionTitle}</span>}
            {chunk.nsCode && (
              <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono">
                {chunk.nsCode}
              </span>
            )}
          </div>
          <div className="whitespace-pre-wrap text-sm leading-relaxed">
            {chunk.chunkText}
          </div>
        </div>
      ))}
    </div>
  );
}
