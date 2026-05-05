"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { trpc } from "@/lib/trpc";

const STORAGE_KEY = "sitedoc-valgt-firma";

interface Firma {
  id: string;
  name: string;
  /**
   * Aktive firmamoduler som slug-array (f.eks. ["timer", "maskin"]).
   * Steg 1e Fase B (2026-05-05) — erstattet harTimerModul/harMaskinModul.
   * Sjekk via `valgtFirma?.aktiveFirmamoduler.includes("timer")`.
   */
  aktiveFirmamoduler: string[];
  erKunde: boolean;
}

interface FirmaKontekstType {
  /** Aktivt valgt firma — null hvis sitedoc_admin uten valg, eller bruker uten firma-tilknytning. */
  valgtFirma: Firma | null;
  /** Firmaer brukeren kan administrere. Tom liste for vanlige brukere. */
  tilgjengelige: Firma[];
  /** Brukeren er sitedoc_admin — styrer om firma-velger vises i Toppbar. */
  erSitedocAdmin: boolean;
  /** Brukeren er company_admin — styrer om fast firma-link vises i Toppbar. */
  erCompanyAdmin: boolean;
  isLoading: boolean;
  velgFirma: (id: string) => void;
}

const FirmaKontekst = createContext<FirmaKontekstType | null>(null);

export function FirmaProvider({ children }: { children: ReactNode }) {
  // Initialiser som null for å unngå hydration-mismatch (localStorage kun på klient)
  const [lagretFirmaId, setLagretFirmaId] = useState<string | null>(null);

  // Les fra localStorage etter mount
  useEffect(() => {
    const lagret = localStorage.getItem(STORAGE_KEY);
    if (lagret) setLagretFirmaId(lagret);
  }, []);

  const tilgjengeligeQuery = trpc.organisasjon.hentTilgjengelige.useQuery();
  const tilgjengelige = (tilgjengeligeQuery.data ?? []) as Firma[];
  const lasterTilgjengelige = tilgjengeligeQuery.isLoading;

  const minBrukerQuery = trpc.bruker.hentMin.useQuery();
  const minBruker = minBrukerQuery.data as { role?: string } | null | undefined;
  const erSitedocAdmin = minBruker?.role === "sitedoc_admin";
  const erCompanyAdmin = minBruker?.role === "company_admin";

  // Bestem valgtFirma:
  //  - sitedoc_admin: respekter localStorage; null hvis ikke valgt
  //  - company_admin/andre: auto-velg eneste tilgjengelige firma (ignorer localStorage
  //    siden de uansett ikke kan bytte)
  let valgtFirma: Firma | null = null;
  if (erSitedocAdmin) {
    if (lagretFirmaId) {
      valgtFirma = tilgjengelige.find((f) => f.id === lagretFirmaId) ?? null;
    }
  } else if (tilgjengelige.length === 1) {
    valgtFirma = tilgjengelige[0] ?? null;
  }

  function velgFirma(id: string) {
    setLagretFirmaId(id);
    localStorage.setItem(STORAGE_KEY, id);
  }

  return (
    <FirmaKontekst.Provider
      value={{
        valgtFirma,
        tilgjengelige,
        erSitedocAdmin,
        erCompanyAdmin,
        isLoading: lasterTilgjengelige || minBrukerQuery.isLoading,
        velgFirma,
      }}
    >
      {children}
    </FirmaKontekst.Provider>
  );
}

export function useFirma() {
  const ctx = useContext(FirmaKontekst);
  if (!ctx) {
    throw new Error("useFirma må brukes innenfor FirmaProvider");
  }
  return ctx;
}
