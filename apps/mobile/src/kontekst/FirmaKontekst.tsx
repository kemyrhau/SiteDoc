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
/** JSON-liste over firma-id-er brukeren er ansatt i (siste vellykkede henting). */
const ANSATT_FIRMA_KEY = "sitedoc_ansatt_firmaer";

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

/**
 * Lagret «Mitt firma»-id (persistert valg). Ren async-funksjon (ikke hook) så den kan
 * leses av TimerSyncProvider, som ligger UTENFOR FirmaProvider i treet og derfor ikke kan
 * bruke `useFirma()`. Kenneth-vedtak 2026-10-09: timer-synk følger det valgte firmaet.
 * Returnerer null hvis intet er lagret (serveren faller da tilbake til medlemskapet).
 */
export async function hentLagretFirmaId(): Promise<string | null> {
  try {
    return await hentVerdi(VALGT_FIRMA_KEY);
  } catch {
    return null;
  }
}

/**
 * Er brukeren ansatt i `orgId`? Fersk query-data først, så sist lagrede liste, ellers
 * `null` (ukjent → dagens atferd; serveren er porten). `erAnsatt` mangler når API-et er
 * eldre enn appen — det er ukjent, ALDRI «ikke ansatt».
 */
export function erAnsattI(
  orgId: string | null | undefined,
  firmaer: ReadonlyArray<{ id: string; erAnsatt?: boolean }>,
  lagretListe: readonly string[] | null,
): boolean | null {
  if (!orgId) return null;
  const firma = firmaer.find((f) => f.id === orgId);
  if (typeof firma?.erAnsatt === "boolean") return firma.erAnsatt;
  if (lagretListe) return lagretListe.includes(orgId);
  return null;
}

async function hentLagretAnsattListe(): Promise<string[] | null> {
  try {
    const raa = await hentVerdi(ANSATT_FIRMA_KEY);
    if (!raa) return null;
    const liste: unknown = JSON.parse(raa);
    return Array.isArray(liste) && liste.every((x) => typeof x === "string")
      ? liste
      : null;
  } catch {
    return null;
  }
}

/**
 * Lagret ansatt-status for `orgId` (hook-fri, som `hentLagretFirmaId`) — for kode som
 * ikke har fersk query-data. `null` = ukjent.
 */
export async function hentLagretAnsattStatus(
  orgId: string | null | undefined,
): Promise<boolean | null> {
  return erAnsattI(orgId, [], await hentLagretAnsattListe());
}

interface Firma {
  id: string;
  name: string;
  erKunde: boolean;
  erAnsatt?: boolean;
}

interface FirmaKontekstType {
  valgtFirmaId: string | null;
  valgtFirma: Firma | null;
  firmaer: Firma[];
  byttFirma: (id: string) => void;
  lasterFirmaer: boolean;
  /** Ansatt i valgt firma? `null` = ukjent. */
  erAnsattIValgtFirma: boolean | null;
  /** Ansatt i et vilkårlig firma (f.eks. sedelens)? `null` = ukjent. */
  erAnsattIFirma: (orgId: string | null | undefined) => boolean | null;
}

const FirmaContext = createContext<FirmaKontekstType>({
  valgtFirmaId: null,
  valgtFirma: null,
  firmaer: [],
  byttFirma: () => {},
  lasterFirmaer: true,
  erAnsattIValgtFirma: null,
  erAnsattIFirma: () => null,
});

export function useFirma() {
  return useContext(FirmaContext);
}

export function FirmaProvider({ children }: { children: ReactNode }) {
  const [valgtFirmaId, setValgtFirmaId] = useState<string | null>(null);
  const [lasterLagret, setLasterLagret] = useState(true);
  const [lagretAnsattListe, setLagretAnsattListe] = useState<string[] | null>(null);

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
    hentLagretAnsattListe().then(setLagretAnsattListe).catch(() => {});
  }, []);

  // Persister ansatt-firmaene når hentingen lyktes — så Slutt dag og sedelen vet
  // svaret offline. Bare når API-et faktisk sender feltet (eldre API = ukjent).
  useEffect(() => {
    const data = firmaerQuery.data;
    if (!data) return;
    if (!data.every((f: Firma) => typeof f.erAnsatt === "boolean")) return;
    const liste = data.filter((f: Firma) => f.erAnsatt).map((f: Firma) => f.id);
    setLagretAnsattListe(liste);
    lagreVerdi(ANSATT_FIRMA_KEY, JSON.stringify(liste)).catch(() => {});
  }, [firmaerQuery.data]);

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

  const erAnsattIFirma = useCallback(
    (orgId: string | null | undefined) =>
      erAnsattI(orgId, firmaer, lagretAnsattListe),
    [firmaer, lagretAnsattListe],
  );
  const erAnsattIValgtFirma = erAnsattIFirma(valgtFirmaId);

  return (
    <FirmaContext.Provider
      value={{
        valgtFirmaId,
        valgtFirma,
        firmaer,
        byttFirma,
        lasterFirmaer,
        erAnsattIValgtFirma,
        erAnsattIFirma,
      }}
    >
      {children}
    </FirmaContext.Provider>
  );
}
