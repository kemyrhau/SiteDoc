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
import * as Location from "expo-location";
import { useProsjekt } from "./ProsjektKontekst";
import { useFirma } from "./FirmaKontekst";
import {
  identifiserByggeplass,
  hentByggeplasserForProsjektLokalt,
} from "../services/byggeplassKatalog";

const BYGGEPLASS_MAP_KEY = "sitedoc_bygning_per_prosjekt";
// F1: per-byggeplass siste-tegning-minne. Erstatter de per-prosjekt-nøklede
// `sitedoc_sist_tegning_{prosjektId}` i OpprettDokumentModal — flyttes hit så
// ByggeplassKontekst er eneste kilde (mockup: «Husker siste tegning per byggeplass»).
const SIST_TEGNING_MAP_KEY = "sitedoc_sist_tegning_per_byggeplass";

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

interface ByggeplassKontekstType {
  valgtBygningId: string | null;
  settBygning: (id: string) => void;
  lasterBygningId: boolean;
  /** F1: siste brukte tegning for en gitt byggeplass (null hvis ingen). */
  hentSistTegning: (byggeplassId: string) => string | null;
  /** F1: husk siste brukte tegning per byggeplass (persistert). */
  settSistTegning: (byggeplassId: string, tegningId: string) => void;
  /** F3: GPS-identifisert byggeplass (org-vid, best-effort hvis posisjon
   *  allerede er tillatt). null = ingen GPS / utenfor geofence. */
  gpsByggeplassId: string | null;
}

const ByggeplassContext = createContext<ByggeplassKontekstType>({
  valgtBygningId: null,
  settBygning: () => {},
  lasterBygningId: true,
  hentSistTegning: () => null,
  settSistTegning: () => {},
  gpsByggeplassId: null,
});

export function useByggeplass() {
  return useContext(ByggeplassContext);
}

export function ByggeplassProvider({ children }: { children: ReactNode }) {
  const { valgtProsjektId } = useProsjekt();
  const { valgtFirmaId } = useFirma();
  const [bygningMap, setBygningMap] = useState<Record<string, string>>({});
  const [sistTegningMap, setSistTegningMap] = useState<Record<string, string>>({});
  const [gpsByggeplassId, setGpsByggeplassId] = useState<string | null>(null);
  const [lasterBygningId, setLasterBygningId] = useState(true);

  // Last lagret bygnings-map + siste-tegning-map ved oppstart
  useEffect(() => {
    async function lastLagret() {
      try {
        const [lagretBygning, lagretTegning] = await Promise.all([
          hentVerdi(BYGGEPLASS_MAP_KEY),
          hentVerdi(SIST_TEGNING_MAP_KEY),
        ]);
        if (lagretBygning) setBygningMap(JSON.parse(lagretBygning));
        if (lagretTegning) setSistTegningMap(JSON.parse(lagretTegning));
      } catch {
        // Ignorer feil
      } finally {
        setLasterBygningId(false);
      }
    }
    lastLagret();
  }, []);

  const valgtBygningId = useMemo(
    () => (valgtProsjektId ? bygningMap[valgtProsjektId] ?? null : null),
    [valgtProsjektId, bygningMap],
  );

  const settBygning = useCallback(
    (id: string) => {
      if (!valgtProsjektId) return;
      setBygningMap((prev) => {
        const neste = { ...prev, [valgtProsjektId]: id };
        lagreVerdi(BYGGEPLASS_MAP_KEY, JSON.stringify(neste)).catch(() => {});
        return neste;
      });
    },
    [valgtProsjektId],
  );

  // F3: GPS-identifiser byggeplass (best-effort — kun hvis posisjon ALLEREDE er
  // tillatt; prompter ikke fra provideren). D1: auto-set kun når ingen byggeplass
  // er valgt for prosjektet OG GPS-treffet hører til prosjektet. Ellers kun
  // forslag (gpsByggeplassId) — aldri stille bytte.
  useEffect(() => {
    if (!valgtProsjektId || !valgtFirmaId) {
      setGpsByggeplassId(null);
      return;
    }
    // Vent til persistert map er lastet — ellers kan auto-set overstyre et
    // lagret valg (race mellom de to mount-effektene).
    if (lasterBygningId) return;
    let aktiv = true;
    (async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (!aktiv || !perm.granted) return;
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!aktiv) return;
        const bygg = identifiserByggeplass(
          pos.coords.latitude,
          pos.coords.longitude,
          valgtFirmaId,
        );
        if (!aktiv) return;
        setGpsByggeplassId(bygg?.id ?? null);
        // D1: auto-set kun når tom + GPS-treff i dette prosjektet. Funksjonell
        // oppdatering leser NYESTE map (race-fri mot persistert lasting); rører
        // ikke et eksisterende valg.
        if (bygg) {
          setBygningMap((prev) => {
            if (prev[valgtProsjektId]) return prev;
            const iProsjekt = hentByggeplasserForProsjektLokalt(
              valgtProsjektId,
            ).some((b) => b.id === bygg.id);
            if (!iProsjekt) return prev;
            const neste = { ...prev, [valgtProsjektId]: bygg.id };
            lagreVerdi(BYGGEPLASS_MAP_KEY, JSON.stringify(neste)).catch(() => {});
            return neste;
          });
        }
      } catch {
        // GPS feilet stille — chip fungerer som manuell velger.
      }
    })();
    return () => {
      aktiv = false;
    };
  }, [valgtProsjektId, valgtFirmaId, lasterBygningId]);

  const hentSistTegning = useCallback(
    (byggeplassId: string) => sistTegningMap[byggeplassId] ?? null,
    [sistTegningMap],
  );

  const settSistTegning = useCallback(
    (byggeplassId: string, tegningId: string) => {
      setSistTegningMap((prev) => {
        const neste = { ...prev, [byggeplassId]: tegningId };
        lagreVerdi(SIST_TEGNING_MAP_KEY, JSON.stringify(neste)).catch(() => {});
        return neste;
      });
    },
    [],
  );

  return (
    <ByggeplassContext.Provider
      value={{
        valgtBygningId,
        settBygning,
        lasterBygningId,
        hentSistTegning,
        settSistTegning,
        gpsByggeplassId,
      }}
    >
      {children}
    </ByggeplassContext.Provider>
  );
}
