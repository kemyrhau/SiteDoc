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
import { adminValgtGjestUtfall, firmabyttUtfall } from "../utils/firmabyttProsjekt";
import { erAdminUtenGjestegruppe } from "@sitedoc/shared";

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
  const { valgtFirmaId, firmaer, erAnsattIFirma } = useFirma();
  // ADMIN-UTEN-GJESTEGRUPPE (Kenneth 2026-11-26, utvider tillegg A): sitedoc_admin beholder
  // aldri et valgt gjesteprosjekt i et annet firma enn det valgte — heller ikke i eget firma
  // (som web, `gjesteIderForNullstilling`).
  const minBruker = trpc.bruker.hentMin.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const adminUtenGjestegruppe = erAdminUtenGjestegruppe(minBruker.data?.role);
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

  // Gjestelista hentes når et firmabytte venter, og for sitedoc_admin (ADMIN-UTEN-GJESTEGRUPPE:
  // et lagret gjestevalg skal nullstilles også uten firmabytte). Server når den svarer;
  // ellers (frakoblet/feil) utledet fra prosjekt_local + ansettelser (15).
  const trengerGjester = ventendeForrigeFirmaId !== null || adminUtenGjestegruppe;
  const gjesteQuery = trpc.prosjekt.hentGjesteprosjekter.useQuery(undefined, {
    enabled: trengerGjester,
  });
  const lasterGjester = gjesteQuery.isPending && gjesteQuery.fetchStatus === "fetching";
  const gjester = useMemo<{ id: string; primaryOrganizationId: string | null }[]>(() => {
    if (!trengerGjester) return [];
    // Lean cast (TS2589-vern, som useProsjektListe).
    const data = gjesteQuery.data as unknown as
      | { id: string; primaryOrganizationId: string | null }[]
      | undefined;
    if (data) return data.map((p) => ({ id: p.id, primaryOrganizationId: p.primaryOrganizationId }));
    return hentGjesteprosjekterLokalt(mineAnsattFirmaIder(firmaer, (id) => erAnsattIFirma(id))).map(
      (p) => ({ id: p.id, primaryOrganizationId: p.primaryOrganizationId }),
    );
  }, [trengerGjester, gjesteQuery.data, firmaer, erAnsattIFirma]);

  useEffect(() => {
    if (ventendeForrigeFirmaId === null) return;
    const utfall = firmabyttUtfall({
      forrigeFirmaId: ventendeForrigeFirmaId,
      valgtFirmaId,
      prosjektId: valgtProsjektId,
      gjester,
      lasterGjester,
      adminUtenGjestegruppe,
    });
    if (utfall === "vent") return;
    if (utfall === "nullstill") {
      setValgtProsjektId(null);
      slettVerdi(VALGT_PROSJEKT_KEY).catch(() => {});
    }
    setVentendeForrigeFirmaId(null);
  }, [ventendeForrigeFirmaId, valgtFirmaId, valgtProsjektId, gjester, lasterGjester, adminUtenGjestegruppe]);

  // ADMIN-UTEN-GJESTEGRUPPE punkt 2: sitedoc_admin med et gjesteprosjekt valgt (lagret fra
  // før, også i eget firma) får valget nullstilt som ved firmabytte. Venter til lagret valg er
  // lest og et eventuelt firmabytte er avgjort; admin går inn i prosjektet ved å bytte firma.
  useEffect(() => {
    if (lasterProsjektId || ventendeForrigeFirmaId !== null) return;
    const utfall = adminValgtGjestUtfall({
      valgtFirmaId,
      prosjektId: valgtProsjektId,
      gjester,
      lasterGjester,
      adminUtenGjestegruppe,
    });
    if (utfall !== "nullstill") return;
    setValgtProsjektId(null);
    slettVerdi(VALGT_PROSJEKT_KEY).catch(() => {});
  }, [lasterProsjektId, ventendeForrigeFirmaId, valgtFirmaId, valgtProsjektId, gjester, lasterGjester, adminUtenGjestegruppe]);

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
