"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Favoritter per bruker — persistert i localStorage.
 *
 * Default brukes for prosjekt-favoritter med nøkkel `sitedoc_favoritter_${userId}`.
 * Andre kategorier (f.eks. byggeplass) sender egen `nokkelPrefix` slik at de
 * lagres separat: `${nokkelPrefix}_${userId}`.
 *
 * Per bruker, ikke per firma — en bruker har samme favoritter uavhengig av
 * aktivt firma. Verdi: JSON-serialisert string[].
 *
 * Feilfallback: tom liste (favoritter er nice-to-have, ikke kritisk).
 */
export function useFavoritter(
  userId: string | undefined,
  nokkelPrefix: string = "sitedoc_favoritter",
): {
  favoritter: string[];
  erFavoritt: (id: string) => boolean;
  toggleFavoritt: (id: string) => void;
} {
  const [favoritter, setFavoritter] = useState<string[]>([]);

  const nokkel = userId ? `${nokkelPrefix}_${userId}` : null;

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
    (id: string) => favoritter.includes(id),
    [favoritter],
  );

  const toggleFavoritt = useCallback(
    (id: string) => {
      if (!nokkel || typeof window === "undefined") return;
      setFavoritter((forrige) => {
        const ny = forrige.includes(id)
          ? forrige.filter((x) => x !== id)
          : [...forrige, id];
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
