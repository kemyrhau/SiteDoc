"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { effektivRekkefolge, vekslKolonne, type LagretKolonner } from "@/lib/kolonneRekkefolge";

interface Tabelloppsett {
  kolonner: string[];
  /** true = `kolonner` er visningsrekkefølgen (se lib/kolonneRekkefolge.ts). */
  rekkefolge?: boolean;
  bredder: Record<string, number>;
  sortering: { kolonne: string; retning: "asc" | "desc" } | null;
}

interface UseTabelloppsettParams {
  liste: string;
  standardKolonner: Set<string>;
  /** Sidens standardrekkefølge for alle kolonner; brukes for oppsett lagret uten rekkefølge. */
  kanoniskRekkefolge: readonly string[];
  /** localStorage-nøkkel for migrering av eksisterende innstillinger */
  migrerNokkel?: string;
  migrerBreddeNokkel?: string;
}

/**
 * Hook for å laste/lagre kolonneinnstillinger fra API (med localStorage-fallback).
 * Debouncer API-kall med 800ms for å unngå spam ved drag-resize.
 * Én kilde til kolonne-rekkefølgen: tabellhodet og «Velg parameter» skriver begge hit.
 */
export function useTabelloppsett({
  liste,
  standardKolonner,
  kanoniskRekkefolge,
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
  const [lagretKolonner, setLagretKolonner] = useState<LagretKolonner>({ kolonner: standardArr });
  const [kolonneBredder, setKolonneBredder] = useState<Record<string, number>>({});
  const [sortering, setSortering] = useState<{ kolonne: string; retning: "asc" | "desc" } | null>(null);

  // Initialiser fra server eller localStorage
  useEffect(() => {
    if (isLoading || initialisert) return;

    if (serverOppsett) {
      setLagretKolonner({ kolonner: serverOppsett.kolonner, rekkefolge: serverOppsett.rekkefolge });
      setKolonneBredder(serverOppsett.bredder ?? {});
      setSortering(serverOppsett.sortering as { kolonne: string; retning: "asc" | "desc" } | null ?? null);
    } else if (typeof window !== "undefined") {
      // Fallback: migrer fra localStorage (gammelt Set → standardrekkefølge)
      try {
        if (migrerNokkel) {
          const lagret = localStorage.getItem(migrerNokkel);
          if (lagret) {
            setLagretKolonner({ kolonner: JSON.parse(lagret) as string[] });
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
  }, [isLoading, serverOppsett, initialisert, migrerNokkel, migrerBreddeNokkel]);

  /** Aktive kolonner i visningsrekkefølge. */
  const kolonneRekkefolge = useMemo(
    () => effektivRekkefolge(lagretKolonner, kanoniskRekkefolge),
    [lagretKolonner, kanoniskRekkefolge],
  );
  const aktiveKolonner = useMemo(() => new Set(kolonneRekkefolge), [kolonneRekkefolge]);

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
    nyeKolonner?: LagretKolonner,
    nyeBredder?: Record<string, number>,
  ) => {
    const k = nyeKolonner ?? lagretKolonner;
    const b = nyeBredder ?? kolonneBredder;
    sisteOppsett.current = { kolonner: k.kolonner, rekkefolge: k.rekkefolge, bredder: b, sortering };
    lagreTilServer();
  }, [lagretKolonner, kolonneBredder, sortering, lagreTilServer]);

  /** Ny visningsrekkefølge for de aktive kolonnene (fra tabellhodet eller velgeren). */
  const handleRekkefolgeEndring = useCallback((ny: string[]) => {
    const neste = { kolonner: ny, rekkefolge: true };
    setLagretKolonner(neste);
    oppdaterOgLagre(neste);
  }, [oppdaterOgLagre]);

  const handleToggleKolonne = useCallback((id: string) => {
    if (id === "__reset__") {
      // Standard: standardkolonnene i sidens standardrekkefølge.
      const standard = { kolonner: standardArr };
      setLagretKolonner(standard);
      setKolonneBredder({});
      oppdaterOgLagre(standard, {});
      return;
    }
    // En kolonne som slås på, havner sist.
    handleRekkefolgeEndring(vekslKolonne(kolonneRekkefolge, id));
  }, [standardArr, oppdaterOgLagre, handleRekkefolgeEndring, kolonneRekkefolge]);

  const handleBreddeEndring = useCallback((bredder: Record<string, number>) => {
    setKolonneBredder(bredder);
    oppdaterOgLagre(undefined, bredder);
  }, [oppdaterOgLagre]);

  return {
    aktiveKolonner,
    kolonneRekkefolge,
    kolonneBredder,
    sortering,
    handleToggleKolonne,
    handleRekkefolgeEndring,
    handleBreddeEndring,
    erLastet: initialisert,
  };
}
