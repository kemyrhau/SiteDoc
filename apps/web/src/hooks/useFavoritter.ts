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
      // Les gjeldende liste fra localStorage FØR mutasjon — storage er
      // sannhetskilden ved skriving. `userId` (og dermed `nokkel`) kommer ofte
      // asynkront, og komponenten kan remonteres (prosjekt-scopet layout), så
      // load-effekten under kan ennå ikke ha kjørt når en toggle fires: `state`
      // er da [] mens storage har innhold. Stolte vi på `forrige` fra setState,
      // ville togglen nullet hele den persisterte lista (mount-race, cowork-målt
      // 2026-08-21). Ved å lese storage her kan en tidlig toggle aldri nulle den.
      let gjeldende: string[] = [];
      try {
        const lagret = localStorage.getItem(nokkel);
        const parsed = lagret ? JSON.parse(lagret) : [];
        if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
          gjeldende = parsed;
        }
      } catch {
        gjeldende = [];
      }
      const ny = gjeldende.includes(id)
        ? gjeldende.filter((x) => x !== id)
        : [...gjeldende, id];
      try {
        localStorage.setItem(nokkel, JSON.stringify(ny));
      } catch {
        // Stille fall — favoritter er nice-to-have.
      }
      setFavoritter(ny); // hold state i synk for lesing (erFavoritt/favoritter)
    },
    [nokkel],
  );

  return { favoritter, erFavoritt, toggleFavoritt };
}
