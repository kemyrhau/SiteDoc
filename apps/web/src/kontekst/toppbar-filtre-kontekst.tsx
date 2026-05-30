"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

/**
 * Toppbar-filtre-kontekst — per-side deklarasjon av hvilke filter-velgere
 * (byggeplass, prosjekt, firma) som ruten faktisk bruker. Velgere som ikke
 * brukes blir visuelt deaktivert (opacity-40 + cursor-not-allowed) slik at
 * brukeren ser at de ikke har effekt på gjeldende side.
 *
 * Default: alle filtre aktive. Sider som ikke bruker et filter kaller
 * useToppbarFiltre({ byggeplass: false }) i en useEffect — hooken setter
 * tilbake til true ved unmount.
 *
 * Strategi B per anbefaling 2026-05-29 (filterbruk-kartleggingen).
 */

interface ToppbarFiltreKontekstType {
  byggeplassAktiv: boolean;
  settByggeplassAktiv: (v: boolean) => void;
}

const ToppbarFiltreKontekst = createContext<ToppbarFiltreKontekstType | null>(null);

export function ToppbarFiltreProvider({ children }: { children: ReactNode }) {
  const [byggeplassAktiv, settByggeplassAktiv] = useState(true);

  return (
    <ToppbarFiltreKontekst.Provider
      value={{ byggeplassAktiv, settByggeplassAktiv }}
    >
      {children}
    </ToppbarFiltreKontekst.Provider>
  );
}

export function useToppbarFiltreKontekst() {
  const ctx = useContext(ToppbarFiltreKontekst);
  if (!ctx) {
    throw new Error(
      "useToppbarFiltreKontekst må brukes innenfor ToppbarFiltreProvider",
    );
  }
  return ctx;
}
