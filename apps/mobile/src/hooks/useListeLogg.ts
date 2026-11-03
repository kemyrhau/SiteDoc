import { useEffect, useRef } from "react";
import { nesteListeLogg } from "../lib/listeLogg";

/**
 * Logger når `sjekkliste.hentForProsjekt` på en skjerm starter og slutter å hente (ORDRE 5,
 * 2026-10-29): spinneren i lista etter KD11 kunne ikke måles i kode. Se `lib/listeLogg.ts`.
 */
export function useListeLogg(
  query: { fetchStatus: string; isError: boolean; data: unknown },
  sted: string,
): void {
  const startRef = useRef<number | null>(null);
  const henter = query.fetchStatus === "fetching";
  useEffect(() => {
    const { start, linje } = nesteListeLogg(startRef.current, {
      henter,
      naa: Date.now(),
      sted,
      antall: Array.isArray(query.data) ? query.data.length : 0,
      feilet: query.isError,
    });
    startRef.current = start;
    if (linje && __DEV__) console.warn(linje);
    // Bare overgangen henter/ikke henter skal gi en linje; data og feil leses ved slutt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [henter, sted]);
}
