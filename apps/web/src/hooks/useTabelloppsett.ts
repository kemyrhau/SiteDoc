"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";

interface Tabelloppsett {
  kolonner: string[];
  bredder: Record<string, number>;
  sortering: { kolonne: string; retning: "asc" | "desc" } | null;
}

interface UseTabelloppsettParams {
  liste: string;
  standardKolonner: Set<string>;
  /** localStorage-nøkkel for migrering av eksisterende innstillinger */
  migrerNokkel?: string;
  migrerBreddeNokkel?: string;
}

/**
 * Hook for å laste/lagre kolonneinnstillinger fra API (med localStorage-fallback).
 * Debouncer API-kall med 800ms for å unngå spam ved drag-resize.
 */
export function useTabelloppsett({
  liste,
  standardKolonner,
  migrerNokkel,
  migrerBreddeNokkel,
}: UseTabelloppsettParams) {
  const standardArr = [...standardKolonner];

  // Hent fra API
  const { data: serverOppsett, isLoading } = trpc.bruker.hentTabelloppsett.useQuery(
    { liste },
    { staleTime: 60_000 },
  );

  // Migrer fra localStorage ved første lasting
  const [initialisert, setInitialisert] = useState(false);
  const [aktiveKolonner, setAktiveKolonner] = useState<Set<string>>(standardKolonner);
  const [kolonneBredder, setKolonneBredder] = useState<Record<string, number>>({});
  const [sortering, setSortering] = useState<{ kolonne: string; retning: "asc" | "desc" } | null>(null);

  // Initialiser fra server eller localStorage
  useEffect(() => {
    if (isLoading || initialisert) return;

    if (serverOppsett) {
      setAktiveKolonner(new Set(serverOppsett.kolonner));
      setKolonneBredder(serverOppsett.bredder ?? {});
      setSortering(serverOppsett.sortering as { kolonne: string; retning: "asc" | "desc" } | null ?? null);
    } else if (typeof window !== "undefined") {
      // Fallback: migrer fra localStorage
      try {
        if (migrerNokkel) {
          const lagret = localStorage.getItem(migrerNokkel);
          if (lagret) {
            setAktiveKolonner(new Set(JSON.parse(lagret) as string[]));
            localStorage.removeItem(migrerNokkel);
          }
        }
        if (migrerBreddeNokkel) {
          const lagret = localStorage.getItem(migrerBreddeNokkel);
          if (lagret) {
            setKolonneBredder(JSON.parse(lagret) as Record<string, number>);
            localStorage.removeItem(migrerBreddeNokkel);
          }
        }
      } catch { /* ignorer */ }
    }
    setInitialisert(true);
  }, [isLoading, serverOppsett, initialisert, migrerNokkel, migrerBreddeNokkel, standardArr]);

  // Debounced lagring til API
  const lagreMutation = trpc.bruker.lagreTabelloppsett.useMutation();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const sisteOppsett = useRef<Tabelloppsett>({ kolonner: standardArr, bredder: {}, sortering: null });

  const lagreTilServer = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      lagreMutation.mutate({
        liste,
        oppsett: sisteOppsett.current,
      });
    }, 800);
  }, [liste, lagreMutation]);

  const oppdaterOgLagre = useCallback((
    nyeKolonner?: Set<string>,
    nyeBredder?: Record<string, number>,
    nySortering?: { kolonne: string; retning: "asc" | "desc" } | null,
  ) => {
    const k = nyeKolonner ?? aktiveKolonner;
    const b = nyeBredder ?? kolonneBredder;
    const s = nySortering !== undefined ? nySortering : sortering;
    sisteOppsett.current = { kolonner: [...k], bredder: b, sortering: s };
    lagreTilServer();
  }, [aktiveKolonner, kolonneBredder, sortering, lagreTilServer]);

  const handleToggleKolonne = useCallback((id: string) => {
    if (id === "__reset__") {
      setAktiveKolonner(new Set(standardKolonner));
      setKolonneBredder({});
      sisteOppsett.current = { kolonner: standardArr, bredder: {}, sortering };
      lagreTilServer();
      return;
    }
    setAktiveKolonner((prev) => {
      const ny = new Set(prev);
      ny.has(id) ? ny.delete(id) : ny.add(id);
      oppdaterOgLagre(ny);
      return ny;
    });
  }, [standardKolonner, standardArr, sortering, lagreTilServer, oppdaterOgLagre]);

  const handleBreddeEndring = useCallback((bredder: Record<string, number>) => {
    setKolonneBredder(bredder);
    oppdaterOgLagre(undefined, bredder);
  }, [oppdaterOgLagre]);

  return {
    aktiveKolonner,
    kolonneBredder,
    sortering,
    handleToggleKolonne,
    handleBreddeEndring,
    erLastet: initialisert,
  };
}
