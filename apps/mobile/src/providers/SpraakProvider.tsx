import { useEffect } from "react";
import type { ReactNode } from "react";
import { useAuth } from "./AuthProvider";
import { hentLagretSpraak, byttSpraak } from "../lib/i18n";
import type { SpraakKode } from "@sitedoc/shared";

/**
 * Synkroniserer i18next-språk med brukerens preferanse.
 * Prioritet: bruker.language (server) > lagret (SecureStore) > nb
 * Ingen blokkering — rendrer med nb mens vi laster.
 */
export function SpraakProvider({ children }: { children: ReactNode }) {
  const { bruker } = useAuth();

  useEffect(() => {
    (async () => {
      const lagret = await hentLagretSpraak();
      const spraak = (bruker?.language as SpraakKode) ?? lagret;
      await byttSpraak(spraak);
    })();
  }, [bruker?.language]);

  return <>{children}</>;
}
