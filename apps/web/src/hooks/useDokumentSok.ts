"use client";

import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import {
  DOK_SOK_DEBOUNCE_MS,
  DOK_SOK_GRENSE,
  skalSokeDokumenter,
  slaaSammenPrDokument,
} from "@/lib/dokument-sok-ctrlk";

/**
 * SØK-2: dokumenttreff til Ctrl K. Gjenbruker `ftdSok.sokDokumenter` (samme port som Dokumentsøk:
 * medlemskap + mappefilter på serveren). Debounced, så sider/innstillinger aldri venter på kallet.
 */
export function useDokumentSok(q: string) {
  const { prosjektId } = useProsjekt();
  const [utsatt, setUtsatt] = useState(q.trim());

  useEffect(() => {
    const id = setTimeout(() => setUtsatt(q.trim()), DOK_SOK_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [q]);

  const aktiv = skalSokeDokumenter(prosjektId, utsatt);
  const { data, isFetching } = trpc.ftdSok.sokDokumenter.useQuery(
    { projectId: prosjektId ?? "", query: utsatt, limit: DOK_SOK_GRENSE },
    { enabled: aktiv, retry: false, staleTime: 30_000 },
  );

  const treff = useMemo(() => (aktiv && data ? slaaSammenPrDokument(data) : []), [aktiv, data]);
  // «Søker …» også mens debouncen venter, så «Ingen treff» ikke blinker før kallet er gjort.
  const venter = skalSokeDokumenter(prosjektId, q) && (utsatt !== q.trim() || isFetching);

  return { prosjektId, treff, venter, sokeord: utsatt };
}
