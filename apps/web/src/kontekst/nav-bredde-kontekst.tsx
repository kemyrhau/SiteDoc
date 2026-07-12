"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * Delt tilstand for sidebarens bredde-trinn (del 5 D2, fabel 2026-07-12).
 *
 * Tre trinn sykles av tre-trinns-knappen: full (220px) → slank (60px ikon-
 * skinne) → skjult (0px). NavSidebar leser bredden for å rendre riktig
 * variant (eller ingenting når skjult); Toppbar viser PanelLeftOpen-
 * henteknappen i 60px-sporet når bredden er «skjult».
 *
 * Tilstanden persisteres per nettleser (localStorage). D5 flytter den til et
 * User-felt via `resolverNyNavigasjon`-mønsteret (konto > lokal > default) —
 * cowork eier den skjema-endringen.
 */

export type NavBredde = "full" | "slank" | "skjult";

const REKKEFOLGE: NavBredde[] = ["full", "slank", "skjult"];
const NOKKEL = "sitedoc-nav-bredde";
// Migrer den gamle binære kollaps-nøkkelen (s1): "1" = slank.
const LEGACY_KOLLAPS_NOKKEL = "sitedoc-nav-kollaps";

function erGyldig(v: string | null): v is NavBredde {
  return v === "full" || v === "slank" || v === "skjult";
}

function neste(b: NavBredde): NavBredde {
  return REKKEFOLGE[(REKKEFOLGE.indexOf(b) + 1) % REKKEFOLGE.length] ?? "full";
}

type NavBreddeKontekstType = {
  bredde: NavBredde;
  nesteBredde: NavBredde;
  syklBredde: () => void;
  settBredde: (b: NavBredde) => void;
};

const NavBreddeKontekst = createContext<NavBreddeKontekstType | null>(null);

export function NavBreddeProvider({ children }: { children: ReactNode }) {
  // Start alltid «full» på server + første render (unngår hydrerings-avvik);
  // faktisk verdi hentes i effekten under.
  const [bredde, setBreddeState] = useState<NavBredde>("full");

  useEffect(() => {
    const lagret = window.localStorage.getItem(NOKKEL);
    if (erGyldig(lagret)) {
      setBreddeState(lagret);
    } else if (window.localStorage.getItem(LEGACY_KOLLAPS_NOKKEL) === "1") {
      setBreddeState("slank");
    }
  }, []);

  function settBredde(b: NavBredde) {
    window.localStorage.setItem(NOKKEL, b);
    setBreddeState(b);
  }

  function syklBredde() {
    setBreddeState((v) => {
      const ny = neste(v);
      window.localStorage.setItem(NOKKEL, ny);
      return ny;
    });
  }

  return (
    <NavBreddeKontekst.Provider
      value={{ bredde, nesteBredde: neste(bredde), syklBredde, settBredde }}
    >
      {children}
    </NavBreddeKontekst.Provider>
  );
}

/**
 * Leser sidebar-bredden. Faller trygt tilbake til «full» + no-op-settere om
 * ingen provider finnes (skal ikke skje — begge konsumentene ligger under
 * dashbord-layoutens provider), så en frittstående Toppbar aldri krasjer.
 */
export function useNavBredde(): NavBreddeKontekstType {
  const ctx = useContext(NavBreddeKontekst);
  if (!ctx) {
    return {
      bredde: "full",
      nesteBredde: "slank",
      syklBredde: () => {},
      settBredde: () => {},
    };
  }
  return ctx;
}
