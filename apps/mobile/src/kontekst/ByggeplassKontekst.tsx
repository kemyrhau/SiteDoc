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

// Brukerminne på server (Kenneth-gate 2026-09-09, fase 1 + radstruktur 2026-09-10):
// sist brukt byggeplass + tegning overlever mobil-reinstallering. Server lagrer ÉN RAD
// PER PROSJEKT (`projectId` satt), ikke én global map. Konflikt mellom to enheter
// isoleres da til det prosjektet som faktisk ble rørt — de to partielle unike indeksene
// er laget for nettopp det. (Fase 1 speilet hele mappen som én global rad; da vant
// «sist skrevne» HELE mappen og en enhet kunne stille slette en annens valg i et urørt
// prosjekt — samme klasse som kollisjonssakene.)
//
// - Byggeplass: nøkkel `sistBruktByggeplass`, projectId=<prosjekt>, verdi = byggeplassId
//   (eller HELE_PROSJEKTET-sentinel). Én rad per prosjekt.
// - Tegning: nøkkel `sistBruktTegning`, projectId=<prosjekt>, verdi = liten map
//   `{byggeplassId: tegningId}`. Én rad per prosjekt; mappen bærer byggeplass-dimensjonen
//   (tegning er per byggeplass, men `projectId` har bare én dimensjon — cowork-rangering).
//
// Lokal SecureStore er UENDRET (flat cache som fase 1): den er enhets-lokal (én bruker
// per enhet), så «sist skrevne»-tapet finnes ikke der. Server = sannheten ved konflikt,
// lokal = hurtigvei/offline. Å la lokal cache stå urørt bevarer brukerens valg gjennom
// overgangen — ingen lokal-cache-migrering. Favoritter er bevisst IKKE med (Kenneth ba
// ikke om dem). Språk/nav-flagg bor på User og røres ikke her.
const SERVER_NOKKEL_BYGGEPLASS = "sistBruktByggeplass";
const SERVER_NOKKEL_TEGNING = "sistBruktTegning";

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

  // Brukerminne: les brukerens lagrede innstillinger (alle rader — global + per
  // prosjekt). Fire-and-forget mutasjon for å speile lokale endringer opp. Refs holder
  // `synkTilServer` stabil så den trygt kan kalles fra write-sitene uten å endre deres
  // identitet.
  const innstillingerQuery = trpc.brukerinnstilling.hent.useQuery(undefined, {
    enabled: !!userId,
    staleTime: 60_000,
  });
  const settMut = trpc.brukerinnstilling.sett.useMutation();
  // Speiler tegning-radene per prosjekt (`{prosjektId: {byggeplassId: tegningId}}`) slik
  // de ligger på server, så en tegning-skriv kan sende HELE prosjektets map (server lagrer
  // én rad per prosjekt). Ren ref — trengs kun for å bygge synk-payloaden, ingen render
  // avhenger av den. Fylles av server-read-effekten og oppdateres ved hver skriv.
  const sistTegningPerProsjektRef = useRef<Record<string, Record<string, string>>>({});
  // Hold synk-funksjonen i en ref med SMAL signatur så `synkTilServer` forblir stabil
  // (tom dep-array). Refen oppdateres hver render → closuren ser nyeste userId + mutate.
  // Verdi sendes som JSON-streng (server parser) — se brukerinnstilling-router-doc.
  // `projectId` er ALLTID satt her (rad per prosjekt) — serveren krever prosjektmedlemskap.
  const synkRef = useRef<(nokkel: string, verdi: unknown, projectId: string) => void>(
    () => {},
  );
  synkRef.current = (nokkel, verdi, projectId) => {
    if (!userId) return; // ikke innlogget → kun lokal cache
    settMut.mutate({ nokkel, verdi: JSON.stringify(verdi), projectId });
  };
  const synkTilServer = useCallback(
    (nokkel: string, verdi: unknown, projectId: string) => {
      synkRef.current(nokkel, verdi, projectId);
    },
    [],
  );

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
    // Kun rader med `projectId` satt teller — gamle globale fase-1-rader (projectId=null,
    // nøkler `sistByggeplassPerProsjekt`/`sistTegningPerByggeplass`) ignoreres bevisst.
    // verdi kommer som JSON-streng (se brukerinnstilling-router) — parse trygt.
    const nyBygg: Record<string, string> = {}; // {prosjektId: byggeplassId|sentinel}
    const nyTegnFlat: Record<string, string> = {}; // flat cache {byggeplassId: tegningId}
    for (const rad of data) {
      if (!rad.projectId) continue;
      if (rad.nokkel === SERVER_NOKKEL_BYGGEPLASS) {
        try {
          nyBygg[rad.projectId] = JSON.parse(rad.verdi) as string;
        } catch {
          // hopp over korrupt rad
        }
      } else if (rad.nokkel === SERVER_NOKKEL_TEGNING) {
        try {
          const map = JSON.parse(rad.verdi) as Record<string, string>;
          sistTegningPerProsjektRef.current[rad.projectId] = map;
          Object.assign(nyTegnFlat, map); // flat ut for lokal per-byggeplass-oppslag
        } catch {
          // hopp over korrupt rad
        }
      }
    }
    if (Object.keys(nyBygg).length > 0) {
      setBygningMap((prev) => {
        const neste = { ...prev, ...nyBygg }; // server vinner ved konflikt
        lagreVerdi(BYGGEPLASS_MAP_KEY, JSON.stringify(neste)).catch(() => {});
        return neste;
      });
    }
    if (Object.keys(nyTegnFlat).length > 0) {
      setSistTegningMap((prev) => {
        const neste = { ...prev, ...nyTegnFlat };
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
        // Server: kun DETTE prosjektets rad (verdi = byggeplassId) — isolert konflikt.
        synkTilServer(SERVER_NOKKEL_BYGGEPLASS, id, valgtProsjektId);
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
      // Sentinel-verdien lagres eksplisitt per prosjekt (samme som lokal).
      synkTilServer(SERVER_NOKKEL_BYGGEPLASS, HELE_PROSJEKTET, valgtProsjektId);
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
            synkTilServer(SERVER_NOKKEL_BYGGEPLASS, bygg.id, valgtProsjektId);
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
      // Lokal flat cache (uendret): per-byggeplass-oppslag på tvers av prosjekter.
      setSistTegningMap((prev) => {
        const neste = { ...prev, [byggeplassId]: tegningId };
        lagreVerdi(SIST_TEGNING_MAP_KEY, JSON.stringify(neste)).catch(() => {});
        return neste;
      });
      // Server: én rad per prosjekt. Send HELE det aktive prosjektets tegning-map (fra
      // ref-speilet, oppdatert med denne byggeplassen) — konflikt isoleres til prosjektet.
      if (!valgtProsjektId) return; // ingen prosjektkontekst → kun lokal cache
      const forrige = sistTegningPerProsjektRef.current[valgtProsjektId] ?? {};
      const nesteMap = { ...forrige, [byggeplassId]: tegningId };
      sistTegningPerProsjektRef.current[valgtProsjektId] = nesteMap;
      synkTilServer(SERVER_NOKKEL_TEGNING, nesteMap, valgtProsjektId);
    },
    [valgtProsjektId, synkTilServer],
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
