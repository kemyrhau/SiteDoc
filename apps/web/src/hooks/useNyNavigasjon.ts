"use client";

import { useEffect, useState } from "react";

// Feature-flagg for navigasjonsredesignet (redesign/navigasjon).
//
// ENESTE kilde til flagget i hele web-koden. Når per-bruker-lagring kommer
// (K7 / OrganizationModule / settings-laget), byttes KILDEN her — ingen
// call-site skal lese localStorage eller query-param direkte.
//
// Plattform-note: dette er web-hooken (localStorage). Når mobil-redesignet
// (2a) bygges trenger React Native en parallell `useNyNavigasjon` med
// AsyncStorage bak samme boolean-kontrakt.
//
// Kontrakt:
// - Flagg AV = eksakt dagens UI. Ingen synlig endring før flagget er PÅ.
// - `?nyNav=1` slår på (og persisterer), `?nyNav=0` slår av (og persisterer).
// - Uten query-param: leser persistert verdi fra localStorage (default av).
// - Flagget gater KUN synlig navigasjon (sidebar/toppbar). Selve ruten
//   `/dashbord/innstillinger` er direkte nåbar via URL uavhengig av flagget.

const LAGRINGSNOKKEL = "sitedoc-ny-navigasjon";

function lesLagret(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(LAGRINGSNOKKEL) === "1";
}

export function useNyNavigasjon(): boolean {
  // Start alltid som «av» på server + første render (unngår hydrerings-avvik);
  // faktisk verdi settes i effekten under.
  const [nyNav, setNyNav] = useState(false);

  // Leser ?nyNav via window.location.search i effekten (kun klient) i stedet
  // for useSearchParams — sistnevnte tvinger <Suspense> rundt hver forbruker
  // og brøt prerender av alle /dashbord/*-sider (dashbord/layout.tsx).
  useEffect(() => {
    const queryVerdi = new URLSearchParams(window.location.search).get("nyNav");
    if (queryVerdi === "1") {
      window.localStorage.setItem(LAGRINGSNOKKEL, "1");
      setNyNav(true);
    } else if (queryVerdi === "0") {
      window.localStorage.setItem(LAGRINGSNOKKEL, "0");
      setNyNav(false);
    } else {
      setNyNav(lesLagret());
    }
  }, []);

  return nyNav;
}
