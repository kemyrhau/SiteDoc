"use client";

import { useMemo } from "react";
import { FileText } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface FulltekstProps {
  documentId: string | null;
  søkeord?: string;
}

export function Fulltekst({ documentId, søkeord }: FulltekstProps) {
  const { data: chunks, isLoading } = trpc.ftdSok.hentDokumentChunks.useQuery(
    { documentId: documentId! },
    { enabled: !!documentId },
  );

  // Bygg sammenhengende tekst per side, fjern overlapp
  const sider = useMemo(() => {
    if (!chunks || chunks.length === 0) return [];

    // Grupper chunks per side
    const perSide = new Map<number, typeof chunks>();
    for (const c of chunks) {
      const side = c.pageNumber ?? 0;
      const arr = perSide.get(side) ?? [];
      arr.push(c);
      perSide.set(side, arr);
    }

    const result: Array<{ side: number; tekst: string; sectionTitle: string | null }> = [];

    for (const [side, sideChunks] of perSide) {
      // Sorter på chunkIndex
      sideChunks.sort((a, b) => a.chunkIndex - b.chunkIndex);

      // Slå sammen tekst og fjern overlapp
      let sammenslått = "";
      for (const chunk of sideChunks) {
        const tekst = chunk.chunkText;
        if (sammenslått.length === 0) {
          sammenslått = tekst;
        } else {
          // Finn overlapp: sjekk om starten av denne chunken overlapper med slutten av forrige
          const overlapp = finnOverlapp(sammenslått, tekst);
          sammenslått += tekst.slice(overlapp);
        }
      }

      result.push({
        side,
        tekst: sammenslått.trim(),
        sectionTitle: sideChunks[0]?.sectionTitle ?? null,
      });
    }

    // Sorter på sidenummer
    result.sort((a, b) => a.side - b.side);
    return result;
  }, [chunks]);

  if (!documentId) {
    return (
      <div className="text-sm text-gray-400">
        Velg et treff for å se dokumentinnhold.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="text-sm text-gray-400">Laster dokumentinnhold...</div>
    );
  }

  if (sider.length === 0) {
    return <div className="text-sm text-gray-400">Ingen innhold funnet.</div>;
  }

  // Finn filnavn fra første chunk
  const filnavn = (chunks as Array<{ document?: { filename?: string } }>)?.[0]?.document?.filename;

  return (
    <div className="space-y-4 overflow-y-auto">
      {filnavn && (
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <FileText className="h-4 w-4 text-gray-400" />
          {filnavn}
        </div>
      )}
      {sider.map((s) => (
        <div key={s.side}>
          {s.side > 0 && (
            <div className="mb-1 text-xs text-gray-400">
              Side {s.side}
              {s.sectionTitle && <span className="ml-2">· {s.sectionTitle}</span>}
            </div>
          )}
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
            {søkeord ? <HighlightTekst tekst={s.tekst} søkeord={søkeord} /> : s.tekst}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Finn antall tegn som overlapper mellom slutten av a og starten av b */
function finnOverlapp(a: string, b: string): number {
  // Sjekk opptil 200 tegn overlapp
  const maks = Math.min(200, a.length, b.length);
  for (let len = maks; len >= 20; len--) {
    const slutt = a.slice(-len);
    const start = b.slice(0, len);
    if (slutt === start) return len;
  }
  return 0;
}

/** Highlight søkeord i tekst */
function HighlightTekst({ tekst, søkeord }: { tekst: string; søkeord: string }) {
  const termer = søkeord
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);

  if (termer.length === 0) return <>{tekst}</>;

  // Bygg regex for alle termer
  const escaped = termer.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${escaped.join("|")})`, "gi");

  const deler = tekst.split(regex);

  return (
    <>
      {deler.map((del, i) => {
        const erMatch = termer.some(
          (t) => del.toLowerCase() === t,
        );
        return erMatch ? (
          <mark key={i} className="rounded bg-yellow-200 px-0.5">
            {del}
          </mark>
        ) : (
          <span key={i}>{del}</span>
        );
      })}
    </>
  );
}
