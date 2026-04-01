"use client";

import { useState, useEffect } from "react";
import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, opprettTrpcKlient } from "@/lib/trpc";
import "@/lib/i18n"; // Initialiserer i18next
import { byttSpraak, hentLagretSpraak } from "@/lib/i18n";
import type { SpraakKode } from "@sitedoc/shared";

function SpraakSynkroniserer() {
  const { data: serverSpraak } = trpc.bruker.hentSpraak.useQuery(undefined, {
    staleTime: Infinity,
  });

  useEffect(() => {
    // Synkroniser server-språk til klient ved innlogging
    if (serverSpraak && serverSpraak !== hentLagretSpraak()) {
      byttSpraak(serverSpraak as SpraakKode);
    }
  }, [serverSpraak]);

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
