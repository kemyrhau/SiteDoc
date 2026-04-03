import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "./AuthProvider";
import { hentLagretSpraak, byttSpraak } from "../lib/i18n";
import type { SpraakKode } from "@sitedoc/shared";

/**
 * Synkroniserer i18next-språk med brukerens preferanse.
 * Prioritet: bruker.language (server) > lagret (SecureStore) > nb
 * Blokkerer children til språket er satt — forhindrer re-render-kaskade
 * der i18next.changeLanguage() midt i mount forstyrrer auto-save hooks.
 */
export function SpraakProvider({ children }: { children: ReactNode }) {
  const { bruker } = useAuth();
  const [klar, setKlar] = useState(false);

  useEffect(() => {
    let avbrutt = false;
    (async () => {
      const lagret = await hentLagretSpraak();
      const spraak = (bruker?.language as SpraakKode) ?? lagret;
      await byttSpraak(spraak);
      if (!avbrutt) setKlar(true);
    })();
    return () => { avbrutt = true; };
  }, [bruker?.language]);

  if (!klar) return null;
  return <>{children}</>;
}
