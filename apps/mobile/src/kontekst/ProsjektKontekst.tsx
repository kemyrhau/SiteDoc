import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { Platform } from "react-native";
import { useFirma } from "./FirmaKontekst";
import { trpc } from "../lib/trpc";
import { hentGjesteprosjekterLokalt } from "../services/prosjektKatalog";
import { mineAnsattFirmaIder } from "../utils/gjesteprosjektListe";
import { firmabyttUtfall } from "../utils/firmabyttProsjekt";
import { erAdminIFremmedFirma } from "@sitedoc/shared";

const VALGT_PROSJEKT_KEY = "sitedoc_valgt_prosjekt";

async function lagreVerdi(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(key, value);
  } else {
    const SecureStore = await import("expo-secure-store");
    await SecureStore.setItemAsync(key, value);
  }
}

async function hentVerdi(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem(key);
  }
  const SecureStore = await import("expo-secure-store");
  return SecureStore.getItemAsync(key);
}

async function slettVerdi(key: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.removeItem(key);
  } else {
    const SecureStore = await import("expo-secure-store");
    await SecureStore.deleteItemAsync(key);
  }
}

interface ProsjektKontekstType {
  valgtProsjektId: string | null;
  byttProsjekt: (id: string) => void;
  lasterProsjektId: boolean;
}

const ProsjektContext = createContext<ProsjektKontekstType>({
  valgtProsjektId: null,
  byttProsjekt: () => {},
  lasterProsjektId: true,
});

export function useProsjekt() {
  return useContext(ProsjektContext);
}

export function ProsjektProvider({ children }: { children: ReactNode }) {
  const { valgtFirmaId, firmaer, erAnsattIFirma, erAnsattIValgtFirma } = useFirma();
  // ADMIN-GJEST tillegg A (2026-11-25): sitedoc_admin i et firma hen ikke er ansatt i
  // beholder ikke et valgt gjesteprosjekt ved firmabytte (som web, `gjesteIderForNullstilling`).
  const minBruker = trpc.bruker.hentMin.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const adminIFremmedFirma = erAdminIFremmedFirma({
    rolle: minBruker.data?.role,
    erAnsattIValgtFirma,
  });
  const [valgtProsjektId, setValgtProsjektId] = useState<string | null>(null);
  const [lasterProsjektId, setLasterProsjektId] = useState(true);
  const prevFirmaId = useRef<string | null>(null);

  // Last lagret prosjekt-ID ved oppstart
  useEffect(() => {
    async function lastLagretProsjekt() {
      try {
        const lagretId = await hentVerdi(VALGT_PROSJEKT_KEY);
        if (lagretId) {
          setValgtProsjektId(lagretId);
        }
      } catch {
        // Ignorer feil ved lasting
      } finally {
        setLasterProsjektId(false);
      }
    }
    lastLagretProsjekt();
  }, []);

  // Firmabytte (ordre (19)): samme regel som web (`skalNullstilleProsjekt` i
  // @sitedoc/shared via `firmabyttUtfall`). Gjesteprosjekt beholdes; prosjekt i
  // forrige firma nullstilles som før. Skip-first-render via useRef hindrer at
  // persistert valg renses ved oppstart (valgtFirmaId null → lagret verdi).
  // Bytte registreres som ventende til gjestelista er kjent.
  const [ventendeForrigeFirmaId, setVentendeForrigeFirmaId] = useState<string | null>(null);
  useEffect(() => {
    const previous = prevFirmaId.current;
    prevFirmaId.current = valgtFirmaId;
    if (previous && previous !== valgtFirmaId) {
      setVentendeForrigeFirmaId(previous);
    }
  }, [valgtFirmaId]);

  // Gjestelista hentes bare når et firmabytte venter. Server når den svarer;
  // ellers (frakoblet/feil) utledet fra prosjekt_local + ansettelser (15).
  const gjesteQuery = trpc.prosjekt.hentGjesteprosjekter.useQuery(undefined, {
    enabled: ventendeForrigeFirmaId !== null,
  });
  const lasterGjester = gjesteQuery.isPending && gjesteQuery.fetchStatus === "fetching";
  const gjester = useMemo<{ id: string; primaryOrganizationId: string | null }[]>(() => {
    if (ventendeForrigeFirmaId === null) return [];
    // Lean cast (TS2589-vern, som useProsjektListe).
    const data = gjesteQuery.data as unknown as
      | { id: string; primaryOrganizationId: string | null }[]
      | undefined;
    if (data) return data.map((p) => ({ id: p.id, primaryOrganizationId: p.primaryOrganizationId }));
    return hentGjesteprosjekterLokalt(mineAnsattFirmaIder(firmaer, (id) => erAnsattIFirma(id))).map(
      (p) => ({ id: p.id, primaryOrganizationId: p.primaryOrganizationId }),
    );
  }, [ventendeForrigeFirmaId, gjesteQuery.data, firmaer, erAnsattIFirma]);

  useEffect(() => {
    if (ventendeForrigeFirmaId === null) return;
    const utfall = firmabyttUtfall({
      forrigeFirmaId: ventendeForrigeFirmaId,
      valgtFirmaId,
      prosjektId: valgtProsjektId,
      gjester,
      lasterGjester,
      adminIFremmedFirma,
    });
    if (utfall === "vent") return;
    if (utfall === "nullstill") {
      setValgtProsjektId(null);
      slettVerdi(VALGT_PROSJEKT_KEY).catch(() => {});
    }
    setVentendeForrigeFirmaId(null);
  }, [ventendeForrigeFirmaId, valgtFirmaId, valgtProsjektId, gjester, lasterGjester, adminIFremmedFirma]);

  const byttProsjekt = useCallback((id: string) => {
    // Eget valg etter firmabyttet vinner over en ventende nullstilling.
    setVentendeForrigeFirmaId(null);
    setValgtProsjektId(id);
    lagreVerdi(VALGT_PROSJEKT_KEY, id).catch(() => {});
  }, []);

  return (
    <ProsjektContext.Provider
      value={{ valgtProsjektId, byttProsjekt, lasterProsjektId }}
    >
      {children}
    </ProsjektContext.Provider>
  );
}
