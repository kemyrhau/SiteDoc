"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type Seksjon =
  | "dashbord"
  | "sjekklister"
  | "oppgaver"
  | "maler"
  | "tegninger"
  | "punktskyer"
  | "modeller"
  | "3d-visning"
  | "tegning-3d"
  | "bilder"
  | "faggrupper"
  | "mapper"
  | "okonomi"
  | "sok"
  | "psi"
  | "timer"
  | "oppsett";

export interface VerktoylinjeHandling {
  id: string;
  label: string;
  ikon?: JSX.Element;
  onClick: () => void;
  variant?: "primary" | "secondary" | "danger";
}

interface NavigasjonKontekstType {
  aktivSeksjon: Seksjon;
  setAktivSeksjon: (seksjon: Seksjon) => void;
  verktoylinjeHandlinger: VerktoylinjeHandling[];
  settVerktoylinjeHandlinger: (handlinger: VerktoylinjeHandling[]) => void;
}

const NavigasjonKontekst = createContext<NavigasjonKontekstType | null>(null);

export function NavigasjonProvider({ children }: { children: ReactNode }) {
  const [aktivSeksjon, setAktivSeksjon] = useState<Seksjon>("dashbord");
  const [verktoylinjeHandlinger, settVerktoylinjeHandlinger] = useState<
    VerktoylinjeHandling[]
  >([]);

  const settHandlinger = useCallback((handlinger: VerktoylinjeHandling[]) => {
    settVerktoylinjeHandlinger(handlinger);
  }, []);

  return (
    <NavigasjonKontekst.Provider
      value={{
        aktivSeksjon,
        setAktivSeksjon,
        verktoylinjeHandlinger,
        settVerktoylinjeHandlinger: settHandlinger,
      }}
    >
      {children}
    </NavigasjonKontekst.Provider>
  );
}

export function useNavigasjon() {
  const ctx = useContext(NavigasjonKontekst);
  if (!ctx) {
    throw new Error("useNavigasjon må brukes innenfor NavigasjonProvider");
  }
  return ctx;
}
