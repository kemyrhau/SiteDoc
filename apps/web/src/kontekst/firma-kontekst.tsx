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
  /** Firmaer brukeren kan administrere (admin-sett). Tom liste for vanlige brukere. */
  tilgjengelige: Firma[];
  /** Brukeren er sitedoc_admin — styrer om firma-velger vises i Toppbar. */
  erSitedocAdmin: boolean;
  /** Brukeren er company_admin — styrer om fast firma-link vises i Toppbar. */
  erCompanyAdmin: boolean;
  /**
   * Kan brukeren administrere det valgte firmaet? (sak #5) Sann for
   * sitedoc_admin, eller når valgtFirma er i admin-settet (`tilgjengelige` =
   * firma_admin-medlemskap). Vanlige ansatte får `valgtFirma` populert for
   * innsyn (prosjekter/timer/maskin) men `kanAdministrereFirma = false` →
   * firma-admin-flatene gates på denne, ikke på `valgtFirma`-eksistens.
   */
  kanAdministrereFirma: boolean;
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

  // Admin-sett: firmaer brukeren kan administrere (firma_admin/sitedoc_admin).
  // Styrer FirmaVelger + kanAdministrereFirma.
  const tilgjengeligeQuery = trpc.organisasjon.hentTilgjengelige.useQuery();
  const tilgjengelige = (tilgjengeligeQuery.data ?? []) as Firma[];

  // Alle medlemskap (sak #5): populerer valgtFirma for ikke-admin ansatte så
  // de ser eget firma + prosjekter/timer/maskin uten å få admin-tilgang.
  const mineMedlemskapQuery = trpc.organisasjon.hentMineMedlemskap.useQuery();
  const mineMedlemskap = (mineMedlemskapQuery.data ?? []) as Firma[];

  const minBrukerQuery = trpc.bruker.hentMin.useQuery();
  const minBruker = minBrukerQuery.data as { role?: string } | null | undefined;
  const erSitedocAdmin = minBruker?.role === "sitedoc_admin";
  const erCompanyAdmin = minBruker?.role === "company_admin";

  // Bestem valgtFirma:
  //  - sitedoc_admin: respekter localStorage (mot admin-settet); null hvis ikke valgt
  //  - andre: auto-velg eneste admin-firma (firma_admin) → ellers eneste
  //    medlemskaps-firma (menig ansatt). Ignorer localStorage — de kan ikke bytte.
  let valgtFirma: Firma | null = null;
  if (erSitedocAdmin) {
    if (lagretFirmaId) {
      valgtFirma = tilgjengelige.find((f) => f.id === lagretFirmaId) ?? null;
    }
  } else if (tilgjengelige.length === 1) {
    valgtFirma = tilgjengelige[0] ?? null;
  } else if (mineMedlemskap.length === 1) {
    valgtFirma = mineMedlemskap[0] ?? null;
  }

  // Admin-kapabilitet: sitedoc_admin, eller valgtFirma i admin-settet. Vanlige
  // ansatte (valgtFirma kun i mineMedlemskap) får false. Bevarer dagens regel:
  // firma-admin-tilgang ≡ sitedoc_admin ∨ firma_admin-medlemskap.
  const kanAdministrereFirma =
    erSitedocAdmin || tilgjengelige.some((f) => f.id === valgtFirma?.id);

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
        kanAdministrereFirma,
        isLoading:
          tilgjengeligeQuery.isLoading ||
          mineMedlemskapQuery.isLoading ||
          minBrukerQuery.isLoading,
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
