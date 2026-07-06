"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useNyNavigasjon } from "@/hooks/useNyNavigasjon";
import { SokModal } from "@/components/layout/SokModal";

/**
 * Provider for den globale søkemodalen (steg iv). Holder åpen-tilstand,
 * registrerer Ctrl/Cmd+K-listeneren (kun når `nyNavigasjon` er på — ingen
 * kollisjon med eksisterende snarveier) og monterer selve modalen.
 */

interface SokModalKontekstType {
  aapne: () => void;
  /** Om søket er aktivt (flagg på) — brukes til å gate «Søk overalt»-pillen. */
  aktivt: boolean;
}

const SokModalKontekst = createContext<SokModalKontekstType | null>(null);

export function SokModalProvider({ children }: { children: ReactNode }) {
  const nyNav = useNyNavigasjon();
  const [apen, setApen] = useState(false);
  const aapne = useCallback(() => setApen(true), []);

  useEffect(() => {
    if (!nyNav) return;
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setApen((a) => !a);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nyNav]);

  return (
    <SokModalKontekst.Provider value={{ aapne, aktivt: nyNav }}>
      {children}
      {nyNav && <SokModal apen={apen} onLukk={() => setApen(false)} />}
    </SokModalKontekst.Provider>
  );
}

export function useSokModal(): SokModalKontekstType {
  return useContext(SokModalKontekst) ?? { aapne: () => {}, aktivt: false };
}
