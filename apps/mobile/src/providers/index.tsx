import { useRef, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { AppState } from "react-native";
import type { AppStateStatus } from "react-native";
import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import { trpc, opprettTrpcKlient } from "../lib/trpc";
import { DatabaseProvider } from "./DatabaseProvider";
import { NettverkProvider } from "./NettverkProvider";
import { OpplastingsKoProvider } from "./OpplastingsKoProvider";
import { AuthProvider } from "./AuthProvider";
import { SpraakProvider } from "./SpraakProvider";
import { ProsjektProvider } from "../kontekst/ProsjektKontekst";
import { BygningProvider } from "../kontekst/BygningKontekst";

// Sideeffekt: initialiser i18next med nb som standard
import "../lib/i18n";
import { loggUt } from "../services/auth";
import { router } from "expo-router";

// Refetch alle synlige queries når appen kommer til forgrunnen
function useAppStateRefetch() {
  useEffect(() => {
    const sub = AppState.addEventListener("change", (status: AppStateStatus) => {
      focusManager.setFocused(status === "active");
    });
    return () => sub.remove();
  }, []);
}

export function Providers({ children }: { children: ReactNode }) {
  const harLoggetUtRef = useRef(false);
  useAppStateRefetch();

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            networkMode: "offlineFirst",
            staleTime: 30 * 1000, // 30 sekunder — sveip ned / app-fokus refetcher
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
                <SpraakProvider>
                  <ProsjektProvider>
                    <BygningProvider>{children}</BygningProvider>
                  </ProsjektProvider>
                </SpraakProvider>
              </AuthProvider>
            </OpplastingsKoProvider>
          </NettverkProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </DatabaseProvider>
  );
}
