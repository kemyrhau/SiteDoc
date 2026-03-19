"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type BilderVisningsmodus = "liste" | "tegning";
export type Plasseringsmodus = "rapportlokasjon" | "gps";

interface BilderKontekstType {
  visningsmodus: BilderVisningsmodus;
  settVisningsmodus: (modus: BilderVisningsmodus) => void;
  plasseringsmodus: Plasseringsmodus;
  settPlasseringsmodus: (modus: Plasseringsmodus) => void;
  datoFra: Date | null;
  datoTil: Date | null;
  settDatoFra: (dato: Date | null) => void;
  settDatoTil: (dato: Date | null) => void;
  områdevalg: { x1: number; y1: number; x2: number; y2: number } | null;
  settOmrådevalg: (valg: { x1: number; y1: number; x2: number; y2: number } | null) => void;
}

const BilderKontekst = createContext<BilderKontekstType | null>(null);

export function BilderProvider({ children }: { children: ReactNode }) {
  const [visningsmodus, setVisningsmodus] = useState<BilderVisningsmodus>("liste");
  const [plasseringsmodus, setPlasseringsmodus] = useState<Plasseringsmodus>("rapportlokasjon");
  const [datoFra, setDatoFra] = useState<Date | null>(null);
  const [datoTil, setDatoTil] = useState<Date | null>(null);
  const [områdevalg, setOmrådevalg] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  const settVisningsmodus = useCallback((modus: BilderVisningsmodus) => {
    setVisningsmodus(modus);
  }, []);

  const settPlasseringsmodus = useCallback((modus: Plasseringsmodus) => {
    setPlasseringsmodus(modus);
  }, []);

  const settDatoFra = useCallback((dato: Date | null) => setDatoFra(dato), []);
  const settDatoTil = useCallback((dato: Date | null) => setDatoTil(dato), []);
  const settOmrådevalg = useCallback(
    (valg: { x1: number; y1: number; x2: number; y2: number } | null) => setOmrådevalg(valg),
    [],
  );

  return (
    <BilderKontekst.Provider
      value={{
        visningsmodus,
        settVisningsmodus,
        plasseringsmodus,
        settPlasseringsmodus,
        datoFra,
        datoTil,
        settDatoFra,
        settDatoTil,
        områdevalg,
        settOmrådevalg,
      }}
    >
      {children}
    </BilderKontekst.Provider>
  );
}

export function useBilder() {
  const ctx = useContext(BilderKontekst);
  if (!ctx) {
    throw new Error("useBilder må brukes innenfor BilderProvider");
  }
  return ctx;
}
