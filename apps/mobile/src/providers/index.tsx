import { useState } from "react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, opprettTrpcKlient } from "../lib/trpc";
import { NettverkProvider } from "./NettverkProvider";
import { AuthProvider } from "./AuthProvider";
import { ProsjektProvider } from "../kontekst/ProsjektKontekst";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            networkMode: "offlineFirst",
            staleTime: 5 * 60 * 1000, // 5 minutter
            retry: 2,
          },
          mutations: {
            networkMode: "offlineFirst",
          },
        },
      }),
  );

  const [trpcClient] = useState(() => opprettTrpcKlient());

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <NettverkProvider>
          <AuthProvider>
            <ProsjektProvider>{children}</ProsjektProvider>
          </AuthProvider>
        </NettverkProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
