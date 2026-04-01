"use client";

import { useState, useEffect } from "react";
import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, opprettTrpcKlient } from "@/lib/trpc";
import "@/lib/i18n"; // Initialiserer i18next
import { byttSpraak, hentLagretSpraak } from "@/lib/i18n";
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

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <SpraakSynkroniserer />
          {children}
        </SessionProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
