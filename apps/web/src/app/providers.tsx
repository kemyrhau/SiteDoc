"use client";

import { useState, useEffect } from "react";
import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, opprettTrpcKlient } from "@/lib/trpc";
import "@/lib/i18n"; // Initialiserer i18next
import { byttSpraak, hentLagretSpraak, spraakKlart, visSiden, SPRAAK_VENTER_SKRIPT } from "@/lib/i18n";
import type { SpraakKode } from "@sitedoc/shared";

function SpraakSynkroniserer() {
  const [harSynkronisert, setHarSynkronisert] = useState(false);
  const lagretSpraak = hentLagretSpraak();

  // Hent kun fra server hvis bruker ikke har valgt språk lokalt
  const { data: serverSpraak } = trpc.bruker.hentSpraak.useQuery(undefined, {
    enabled: !harSynkronisert && lagretSpraak === "nb",
    staleTime: Infinity,
  });

  useEffect(() => {
    if (harSynkronisert) return;
    // Hvis bruker har lagret språk lokalt, bruk det
    if (lagretSpraak !== "nb") {
      byttSpraak(lagretSpraak);
      setHarSynkronisert(true);
      return;
    }
    // Ellers synkroniser fra server (første innlogging)
    if (serverSpraak && serverSpraak !== "nb") {
      byttSpraak(serverSpraak as SpraakKode);
      setHarSynkronisert(true);
    }
  }, [serverSpraak, lagretSpraak, harSynkronisert]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() => opprettTrpcKlient());

  // Lagret språk (≠ nb) lastes dynamisk; siden er skjult av SPRAAK_VENTER_SKRIPT til det er
  // aktivert og tegnet på nytt — ingen ser norsk tekst først (ORDRE 3D-mobil 6).
  useEffect(() => {
    let avbrutt = false;
    void spraakKlart.then(() => {
      // setTimeout, ikke requestAnimationFrame: rAF står stille i skjulte faner/WebView-er.
      // 30 ms gir React tid til å tegne på nytt etter changeLanguage før siden vises.
      if (!avbrutt) setTimeout(visSiden, 30);
    });
    return () => { avbrutt = true; };
  }, []);

  return (
    <>
    <script dangerouslySetInnerHTML={{ __html: SPRAAK_VENTER_SKRIPT }} />
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <SpraakSynkroniserer />
          {children}
        </SessionProvider>
      </QueryClientProvider>
    </trpc.Provider>
    </>
  );
}
