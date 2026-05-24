import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { Platform } from "react-native";
import { trpc } from "../lib/trpc";

const VALGT_FIRMA_KEY = "sitedoc_valgt_firma";

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

interface Firma {
  id: string;
  name: string;
  erKunde: boolean;
}

interface FirmaKontekstType {
  valgtFirmaId: string | null;
  valgtFirma: Firma | null;
  firmaer: Firma[];
  byttFirma: (id: string) => void;
  lasterFirmaer: boolean;
}

const FirmaContext = createContext<FirmaKontekstType>({
  valgtFirmaId: null,
  valgtFirma: null,
  firmaer: [],
  byttFirma: () => {},
  lasterFirmaer: true,
});

export function useFirma() {
  return useContext(FirmaContext);
}

export function FirmaProvider({ children }: { children: ReactNode }) {
  const [valgtFirmaId, setValgtFirmaId] = useState<string | null>(null);
  const [lasterLagret, setLasterLagret] = useState(true);

  const firmaerQuery = trpc.organisasjon.hentMineMedlemskap.useQuery(undefined, {
    staleTime: 60 * 1000,
  });
  const firmaer = useMemo(
    () => firmaerQuery.data ?? [],
    [firmaerQuery.data],
  );
  const lasterFirmaer = firmaerQuery.isLoading || lasterLagret;

  useEffect(() => {
    async function lastLagretFirma() {
      try {
        const lagretId = await hentVerdi(VALGT_FIRMA_KEY);
        if (lagretId) setValgtFirmaId(lagretId);
      } catch {
        // Ignorer feil ved lasting
      } finally {
        setLasterLagret(false);
      }
    }
    lastLagretFirma();
  }, []);

  useEffect(() => {
    if (firmaerQuery.isLoading) return;
    if (lasterLagret) return;

    if (firmaer.length === 1 && !valgtFirmaId) {
      setValgtFirmaId(firmaer[0].id);
      lagreVerdi(VALGT_FIRMA_KEY, firmaer[0].id).catch(() => {});
      return;
    }

    if (valgtFirmaId && !firmaer.some((f) => f.id === valgtFirmaId)) {
      setValgtFirmaId(null);
      slettVerdi(VALGT_FIRMA_KEY).catch(() => {});
    }
  }, [firmaer, firmaerQuery.isLoading, lasterLagret, valgtFirmaId]);

  const byttFirma = useCallback((id: string) => {
    setValgtFirmaId(id);
    lagreVerdi(VALGT_FIRMA_KEY, id).catch(() => {});
  }, []);

  const valgtFirma = useMemo(
    () => firmaer.find((f) => f.id === valgtFirmaId) ?? null,
    [firmaer, valgtFirmaId],
  );

  return (
    <FirmaContext.Provider
      value={{
        valgtFirmaId,
        valgtFirma,
        firmaer,
        byttFirma,
        lasterFirmaer,
      }}
    >
      {children}
    </FirmaContext.Provider>
  );
}
