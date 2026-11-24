"use client";

import { useCallback, useEffect, useState } from "react";

/** localStorage-nøkkelen pr. bruker (samme mønster som `useFavoritter`). */
export const BARE_OVERSIKT_NOKKEL = "sitedoc_attestering_bareOversikt";

/**
 * A1 (plan § 4.17, B51 A): «Bare oversiktsrader» er på som standard — linjene er skjult til
 * attestanten åpner dagen — og valget huskes pr. bruker i denne nettleseren. Uten innlogget
 * bruker (eller uten lagring) gjelder standarden for besøket.
 */
export function useBareOversikt(userId: string | undefined): [boolean, (v: boolean) => void] {
  const nokkel = userId ? `${BARE_OVERSIKT_NOKKEL}_${userId}` : null;
  const [verdi, setVerdi] = useState(true);

  useEffect(() => {
    if (!nokkel || typeof window === "undefined") return;
    try {
      const lagret = localStorage.getItem(nokkel);
      setVerdi(lagret === null ? true : lagret === "true");
    } catch {
      setVerdi(true);
    }
  }, [nokkel]);

  const sett = useCallback(
    (v: boolean) => {
      setVerdi(v);
      if (!nokkel || typeof window === "undefined") return;
      try {
        localStorage.setItem(nokkel, String(v));
      } catch {
        // Lagringen er en bekvemmelighet; valget gjelder besøket uansett.
      }
    },
    [nokkel],
  );

  return [verdi, sett];
}
