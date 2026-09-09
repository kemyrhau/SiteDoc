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
import * as Location from "expo-location";
import { useProsjekt } from "./ProsjektKontekst";
import { useFirma } from "./FirmaKontekst";
import { useAuth } from "../providers/AuthProvider";
import { trpc } from "../lib/trpc";
import {
  identifiserByggeplass,
  hentByggeplasserForProsjektLokalt,
} from "../services/byggeplassKatalog";

const BYGGEPLASS_MAP_KEY = "sitedoc_bygning_per_prosjekt";
// Sentinel i bygningMap: brukeren har EKSPLISITT valgt «Hele prosjektet» (ingen
// byggeplass-avgrensning). Må lagres som en verdi — ikke fravær av nøkkel — ellers
// ville GPS-autovalget (D1: «auto-set kun når tom») fylle inn en byggeplass stille
// igjen, som er nøyaktig feilen vi retter (feltarbeideren har ingen vei ut av filteret).
const HELE_PROSJEKTET = "__hele_prosjektet__";
// F1: per-byggeplass siste-tegning-minne. Erstatter de per-prosjekt-nøklede
// `sitedoc_sist_tegning_{prosjektId}` i OpprettDokumentModal — flyttes hit så
// ByggeplassKontekst er eneste kilde (mockup: «Husker siste tegning per byggeplass»).
const SIST_TEGNING_MAP_KEY = "sitedoc_sist_tegning_per_byggeplass";
// F6: favoritt-byggeplasser (lokalt sett, ingen server). Enhets-lokalt som de
// øvrige nøklene (én bruker per enhet i praksis).
const FAVORITT_KEY = "sitedoc_byggeplass_favoritter";

// Brukerminne på server (Kenneth-gate 2026-09-09, fase 1): sist brukt byggeplass +
// tegning overlever mobil-reinstallering. Hele mappet speiles som én GLOBAL rad per
// nøkkel (projectId=null) — 1:1 med de lokale SecureStore-mappene. Lokal =
// cache/offline (hurtigveien), server = sannheten ved konflikt. Favoritter er bevisst
// IKKE med (Kenneth ba ikke om dem). Språk/nav-flagg bor på User og røres ikke her.
const SERVER_NOKKEL_BYGGEPLASS = "sistByggeplassPerProsjekt";
const SERVER_NOKKEL_TEGNING = "sistTegningPerByggeplass";

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
  /** Aktiv byggeplass-id, eller null når ingen avgrensning gjelder (uvalgt ELLER
   *  «Hele prosjektet»). Lister sender denne som `byggeplassId` → null = hele prosjektet. */
  valgtBygningId: string | null;
  settBygning: (id: string) => void;
  /** True når brukeren EKSPLISITT valgte «Hele prosjektet». Skiller det bevisste
   *  valget fra «ingen valgt ennå» (som GPS fortsatt kan fylle inn). */
  erHeleProsjektet: boolean;
  /** Velg «Hele prosjektet» — nullstiller byggeplass-filteret og hindrer at GPS
   *  autovalg setter en byggeplass stille igjen. */
  velgHeleProsjektet: () => void;
  lasterBygningId: boolean;
  /** F1: siste brukte tegning for en gitt byggeplass (null hvis ingen). */
  hentSistTegning: (byggeplassId: string) => string | null;
  /** F1: husk siste brukte tegning per byggeplass (persistert). */
  settSistTegning: (byggeplassId: string, tegningId: string) => void;
  /** F3: GPS-identifisert byggeplass (org-vid, best-effort hvis posisjon
   *  allerede er tillatt). null = ingen GPS / utenfor geofence. */
  gpsByggeplassId: string | null;
  /** F6: favoritt-byggeplass-IDer (lokalt). */
  favorittIder: string[];
  /** F6: veksle favoritt-status for en byggeplass (persistert). */
  toggleFavoritt: (byggeplassId: string) => void;
}

const ByggeplassContext = createContext<ByggeplassKontekstType>({
  valgtBygningId: null,
  settBygning: () => {},
  erHeleProsjektet: false,
  velgHeleProsjektet: () => {},
  lasterBygningId: true,
  hentSistTegning: () => null,
  settSistTegning: () => {},
  gpsByggeplassId: null,
  favorittIder: [],
  toggleFavoritt: () => {},
});

export function useByggeplass() {
  return useContext(ByggeplassContext);
}

export function ByggeplassProvider({ children }: { children: ReactNode }) {
  const { valgtProsjektId } = useProsjekt();
  const { valgtFirmaId } = useFirma();
  const { bruker } = useAuth();
  const userId = bruker?.id ?? null;
  const [bygningMap, setBygningMap] = useState<Record<string, string>>({});
  const [sistTegningMap, setSistTegningMap] = useState<Record<string, string>>({});
  const [gpsByggeplassId, setGpsByggeplassId] = useState<string | null>(null);
  const [favorittIder, setFavorittIder] = useState<string[]>([]);
  const [lasterBygningId, setLasterBygningId] = useState(true);

  // Brukerminne: les brukerens lagrede innstillinger (global rad-blob). Fire-and-forget
  // mutasjon for å speile lokale endringer opp. Refs holder `synkTilServer` stabil så
  // den trygt kan kalles fra write-sitene uten å endre deres identitet.
  const innstillingerQuery = trpc.brukerinnstilling.hent.useQuery(undefined, {
    enabled: !!userId,
    staleTime: 60_000,
  });
  const settMut = trpc.brukerinnstilling.sett.useMutation();
  // Hold synk-funksjonen i en ref med SMAL signatur så `synkTilServer` forblir stabil
  // (tom dep-array). Refen oppdateres hver render → closuren ser nyeste userId + mutate.
  // Verdi sendes som JSON-streng (server parser) — se brukerinnstilling-router-doc.
  const synkRef = useRef<(nokkel: string, verdi: unknown) => void>(() => {});
  synkRef.current = (nokkel, verdi) => {
    if (!userId) return; // ikke innlogget → kun lokal cache
    settMut.mutate({ nokkel, verdi: JSON.stringify(verdi) });
  };
  const synkTilServer = useCallback((nokkel: string, verdi: unknown) => {
    synkRef.current(nokkel, verdi);
  }, []);

  // Last lagret bygnings-map + siste-tegning-map + favoritter ved oppstart
  useEffect(() => {
    async function lastLagret() {
      try {
        const [lagretBygning, lagretTegning, lagretFavoritt] = await Promise.all([
          hentVerdi(BYGGEPLASS_MAP_KEY),
          hentVerdi(SIST_TEGNING_MAP_KEY),
          hentVerdi(FAVORITT_KEY),
        ]);
        if (lagretBygning) setBygningMap(JSON.parse(lagretBygning));
        if (lagretTegning) setSistTegningMap(JSON.parse(lagretTegning));
        if (lagretFavoritt) setFavorittIder(JSON.parse(lagretFavoritt));
      } catch {
        // Ignorer feil
      } finally {
        setLasterBygningId(false);
      }
    }
    lastLagret();
  }, []);

  // Server er sannheten: når brukerens lagrede innstillinger ankommer, la server-verdiene
  // vinne over lokal cache per nøkkel — men behold lokale-only nøkler (skrevet offline,
  // ennå ikke synket opp). Speil resultatet til cachen. `serverMerget` gjør at flettingen
  // skjer én gang per innlogging (resettes når userId endres, under).
  const serverMerget = useRef(false);
  useEffect(() => {
    serverMerget.current = false;
  }, [userId]);
  useEffect(() => {
    const data = innstillingerQuery.data;
    if (!data || serverMerget.current) return;
    serverMerget.current = true;
    // verdi kommer som JSON-streng (se brukerinnstilling-router) — parse trygt.
    const parse = (nokkel: string): Record<string, string> | undefined => {
      const rad = data.find((r) => r.projectId === null && r.nokkel === nokkel);
      if (!rad) return undefined;
      try {
        return JSON.parse(rad.verdi) as Record<string, string>;
      } catch {
        return undefined;
      }
    };
    const bygg = parse(SERVER_NOKKEL_BYGGEPLASS);
    const tegn = parse(SERVER_NOKKEL_TEGNING);
    if (bygg) {
      setBygningMap((prev) => {
        const neste = { ...prev, ...bygg }; // server vinner ved konflikt
        lagreVerdi(BYGGEPLASS_MAP_KEY, JSON.stringify(neste)).catch(() => {});
        return neste;
      });
    }
    if (tegn) {
      setSistTegningMap((prev) => {
        const neste = { ...prev, ...tegn };
        lagreVerdi(SIST_TEGNING_MAP_KEY, JSON.stringify(neste)).catch(() => {});
        return neste;
      });
    }
  }, [innstillingerQuery.data, userId]);

  // Sentinel-verdien HELE_PROSJEKTET betyr «ingen avgrensning» → valgtBygningId er
  // null (lister sender ingen byggeplassId, akkurat som web «Hele prosjektet»).
  const valgtBygningId = useMemo(() => {
    const raa = valgtProsjektId ? bygningMap[valgtProsjektId] ?? null : null;
    return raa === HELE_PROSJEKTET ? null : raa;
  }, [valgtProsjektId, bygningMap]);

  const erHeleProsjektet = useMemo(
    () => (valgtProsjektId ? bygningMap[valgtProsjektId] === HELE_PROSJEKTET : false),
    [valgtProsjektId, bygningMap],
  );

  const settBygning = useCallback(
    (id: string) => {
      if (!valgtProsjektId) return;
      setBygningMap((prev) => {
        const neste = { ...prev, [valgtProsjektId]: id };
        lagreVerdi(BYGGEPLASS_MAP_KEY, JSON.stringify(neste)).catch(() => {});
        synkTilServer(SERVER_NOKKEL_BYGGEPLASS, neste);
        return neste;
      });
    },
    [valgtProsjektId, synkTilServer],
  );

  const velgHeleProsjektet = useCallback(() => {
    if (!valgtProsjektId) return;
    setBygningMap((prev) => {
      const neste = { ...prev, [valgtProsjektId]: HELE_PROSJEKTET };
      lagreVerdi(BYGGEPLASS_MAP_KEY, JSON.stringify(neste)).catch(() => {});
      synkTilServer(SERVER_NOKKEL_BYGGEPLASS, neste);
      return neste;
    });
  }, [valgtProsjektId, synkTilServer]);

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
            synkTilServer(SERVER_NOKKEL_BYGGEPLASS, neste);
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
  }, [valgtProsjektId, valgtFirmaId, lasterBygningId, synkTilServer]);

  const hentSistTegning = useCallback(
    (byggeplassId: string) => sistTegningMap[byggeplassId] ?? null,
    [sistTegningMap],
  );

  const settSistTegning = useCallback(
    (byggeplassId: string, tegningId: string) => {
      setSistTegningMap((prev) => {
        const neste = { ...prev, [byggeplassId]: tegningId };
        lagreVerdi(SIST_TEGNING_MAP_KEY, JSON.stringify(neste)).catch(() => {});
        synkTilServer(SERVER_NOKKEL_TEGNING, neste);
        return neste;
      });
    },
    [synkTilServer],
  );

  const toggleFavoritt = useCallback((byggeplassId: string) => {
    setFavorittIder((prev) => {
      const neste = prev.includes(byggeplassId)
        ? prev.filter((id) => id !== byggeplassId)
        : [...prev, byggeplassId];
      lagreVerdi(FAVORITT_KEY, JSON.stringify(neste)).catch(() => {});
      return neste;
    });
  }, []);

  return (
    <ByggeplassContext.Provider
      value={{
        valgtBygningId,
        settBygning,
        erHeleProsjektet,
        velgHeleProsjektet,
        lasterBygningId,
        hentSistTegning,
        settSistTegning,
        gpsByggeplassId,
        favorittIder,
        toggleFavoritt,
      }}
    >
      {children}
    </ByggeplassContext.Provider>
  );
}
