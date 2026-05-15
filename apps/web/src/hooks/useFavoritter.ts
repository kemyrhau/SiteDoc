"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Favoritt-prosjekter per bruker — persistert i localStorage.
 *
 * Nøkkel: `sitedoc_favoritter_${userId}`. Verdi: JSON-serialisert string[].
 * Per bruker, ikke per firma — en bruker har samme favoritter uavhengig av
 * aktivt firma.
 *
 * Feilfallback: tom liste (favoritter er nice-to-have, ikke kritisk).
 */
export function useFavoritter(userId: string | undefined): {
  favoritter: string[];
  erFavoritt: (projectId: string) => boolean;
  toggleFavoritt: (projectId: string) => void;
} {
  const [favoritter, setFavoritter] = useState<string[]>([]);

  const nokkel = userId ? `sitedoc_favoritter_${userId}` : null;

  useEffect(() => {
    if (!nokkel || typeof window === "undefined") return;
    try {
      const lagret = localStorage.getItem(nokkel);
      if (lagret) {
        const parsed = JSON.parse(lagret);
        if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
          setFavoritter(parsed);
          return;
        }
      }
      setFavoritter([]);
    } catch {
      setFavoritter([]);
    }
  }, [nokkel]);

  const erFavoritt = useCallback(
    (projectId: string) => favoritter.includes(projectId),
    [favoritter],
  );

  const toggleFavoritt = useCallback(
    (projectId: string) => {
      if (!nokkel || typeof window === "undefined") return;
      setFavoritter((forrige) => {
        const ny = forrige.includes(projectId)
          ? forrige.filter((id) => id !== projectId)
          : [...forrige, projectId];
        try {
          localStorage.setItem(nokkel, JSON.stringify(ny));
        } catch {
          // Stille fall — favoritter er nice-to-have.
        }
        return ny;
      });
    },
    [nokkel],
  );

  return { favoritter, erFavoritt, toggleFavoritt };
}
