import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, opprettTrpcKlient } from "../lib/trpc";
import { DatabaseProvider } from "./DatabaseProvider";
import { NettverkProvider } from "./NettverkProvider";
import { OpplastingsKoProvider } from "./OpplastingsKoProvider";
import { AuthProvider } from "./AuthProvider";
import { ProsjektProvider } from "../kontekst/ProsjektKontekst";
import { loggUt } from "../services/auth";
import { router } from "expo-router";

export function Providers({ children }: { children: ReactNode }) {
  const harLoggetUtRef = useRef(false);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            networkMode: "offlineFirst",
            staleTime: 5 * 60 * 1000, // 5 minutter
            retry: (failureCount, error) => {
              // Ikke retry ved UNAUTHORIZED — sesjonen er ugyldig
              const erUautorisert =
                (error as { data?: { code?: string } })?.data?.code === "UNAUTHORIZED" ||
                (error as { message?: string })?.message?.includes("UNAUTHORIZED") ||
                (error as { shape?: { data?: { code?: string } } })?.shape?.data?.code === "UNAUTHORIZED";
              if (erUautorisert) {
                if (!harLoggetUtRef.current) {
                  harLoggetUtRef.current = true;
                  loggUt().then(() => {
                    router.replace("/logg-inn");
                  });
                }
                return false;
              }
              return failureCount < 2;
            },
          },
          mutations: {
            networkMode: "offlineFirst",
          },
        },
      }),
  );

  const [trpcClient] = useState(() => opprettTrpcKlient());

  return (
    <DatabaseProvider>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <NettverkProvider>
            <OpplastingsKoProvider>
              <AuthProvider>
                <ProsjektProvider>{children}</ProsjektProvider>
              </AuthProvider>
            </OpplastingsKoProvider>
          </NettverkProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </DatabaseProvider>
  );
}
