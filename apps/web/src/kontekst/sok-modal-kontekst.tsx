"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { SokModal } from "@/components/layout/SokModal";

/**
 * Provider for den globale søkemodalen (steg iv). Holder åpen-tilstand,
 * registrerer Ctrl/Cmd+K-listeneren og monterer selve modalen.
 */

interface SokModalKontekstType {
  aapne: () => void;
  /** Om søket er aktivt — brukes til å gate «Søk overalt»-pillen. */
  aktivt: boolean;
}

const SokModalKontekst = createContext<SokModalKontekstType | null>(null);

export function SokModalProvider({ children }: { children: ReactNode }) {
  const [apen, setApen] = useState(false);
  const aapne = useCallback(() => setApen(true), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setApen((a) => !a);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <SokModalKontekst.Provider value={{ aapne, aktivt: true }}>
      {children}
      <SokModal apen={apen} onLukk={() => setApen(false)} />
    </SokModalKontekst.Provider>
  );
}

export function useSokModal(): SokModalKontekstType {
  return useContext(SokModalKontekst) ?? { aapne: () => {}, aktivt: false };
}
