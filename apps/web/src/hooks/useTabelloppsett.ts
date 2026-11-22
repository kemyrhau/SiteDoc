"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { effektivRekkefolge, medTillagteKolonner, vekslKolonne, type LagretKolonner, type TillagteKolonner } from "@/lib/kolonneRekkefolge";

interface Tabelloppsett {
  kolonner: string[];
  /** true = `kolonner` er visningsrekkefølgen (se lib/kolonneRekkefolge.ts). */
  rekkefolge?: boolean;
  /** O13 (R3): kolonnene som er satt inn i oppsettet (`medTillagteKolonner`). */
  tillagt?: string[];
  bredder: Record<string, number>;
  sortering: { kolonne: string; retning: "asc" | "desc" } | null;
}

interface UseTabelloppsettParams {
  liste: string;
  standardKolonner: Set<string>;
  /** Sidens standardrekkefølge for alle kolonner; brukes for oppsett lagret uten rekkefølge. */
  kanoniskRekkefolge: readonly string[];
  /**
   * true = standardkolonnene (ny bruker og «Nullstill») vises i sin egen rekkefølge og lagres
   * med `rekkefolge: true`. Uten flagget følger standarden `kanoniskRekkefolge` som før.
   */
  standardMedRekkefolge?: boolean;
  /**
   * O13 (R3): kolonner lagt til standardutvalget etter at brukere har lagret oppsett. Et lagret
   * oppsett får dem satt inn rett etter `etter`, én gang; skjuler brukeren dem, står de skjult.
   */
  tillegg?: TillagteKolonner;
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
  standardMedRekkefolge,
  tillegg,
  migrerNokkel,
  migrerBreddeNokkel,
}: UseTabelloppsettParams) {
  const standardArr = [...standardKolonner];
  // O13 (R3): standarden har de tillagte kolonnene med, så de føres i `tillagt` fra første lagring.
  const standardTillagt = tillegg ? { tillagt: tillegg.ider.filter((id) => standardKolonner.has(id)) } : {};
  const standardOppsett: LagretKolonner & { tillagt?: string[] } = standardMedRekkefolge
    ? { kolonner: standardArr, rekkefolge: true, ...standardTillagt }
    : { kolonner: standardArr, ...standardTillagt };

  // Hent fra API
  const { data: serverOppsett, isLoading } = trpc.bruker.hentTabelloppsett.useQuery(
    { liste },
    { staleTime: 60_000 },
  );

  // Migrer fra localStorage ved første lasting
  const [initialisert, setInitialisert] = useState(false);
  const [lagretKolonner, setLagretKolonner] = useState<LagretKolonner & { tillagt?: string[] }>(standardOppsett);
  const [kolonneBredder, setKolonneBredder] = useState<Record<string, number>>({});
  const [sortering, setSortering] = useState<{ kolonne: string; retning: "asc" | "desc" } | null>(null);

  // Initialiser fra server eller localStorage
  useEffect(() => {
    if (isLoading || initialisert) return;

    if (serverOppsett) {
      const lest = { kolonner: serverOppsett.kolonner, rekkefolge: serverOppsett.rekkefolge, tillagt: serverOppsett.tillagt };
      setLagretKolonner(tillegg ? medTillagteKolonner(lest, kanoniskRekkefolge, tillegg) : lest);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- leses én gang ved første lasting
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
  const sisteOppsett = useRef<Tabelloppsett>({ ...standardOppsett, bredder: {}, sortering: null });

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
    nyeKolonner?: LagretKolonner & { tillagt?: string[] },
    nyeBredder?: Record<string, number>,
  ) => {
    const k = nyeKolonner ?? lagretKolonner;
    const b = nyeBredder ?? kolonneBredder;
    sisteOppsett.current = {
      kolonner: k.kolonner,
      rekkefolge: k.rekkefolge,
      ...(k.tillagt ? { tillagt: k.tillagt } : {}),
      bredder: b,
      sortering,
    };
    lagreTilServer();
  }, [lagretKolonner, kolonneBredder, sortering, lagreTilServer]);

  /** Ny visningsrekkefølge for de aktive kolonnene (fra tabellhodet eller velgeren). */
  const handleRekkefolgeEndring = useCallback((ny: string[]) => {
    // `tillagt` følger med, så en tillagt kolonne brukeren skjuler, står skjult (O13, R3).
    const neste = { kolonner: ny, rekkefolge: true, ...(lagretKolonner.tillagt ? { tillagt: lagretKolonner.tillagt } : {}) };
    setLagretKolonner(neste);
    oppdaterOgLagre(neste);
  }, [oppdaterOgLagre, lagretKolonner.tillagt]);

  const handleToggleKolonne = useCallback((id: string) => {
    if (id === "__reset__") {
      // Standard: standardkolonnene i sidens standardrekkefølge (eller sin egen, se flagget).
      setLagretKolonner(standardOppsett);
      setKolonneBredder({});
      oppdaterOgLagre(standardOppsett, {});
      return;
    }
    // En kolonne som slås på, havner sist.
    handleRekkefolgeEndring(vekslKolonne(kolonneRekkefolge, id));
  }, [standardOppsett, oppdaterOgLagre, handleRekkefolgeEndring, kolonneRekkefolge]);

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
