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
import { AppState, Platform } from "react-native";
import * as Location from "expo-location";
import { useProsjekt } from "./ProsjektKontekst";
import { and, desc, eq } from "drizzle-orm";
import {
  oppdaterBygningMap,
  velgFilterByggeplass,
  velgTimerByggeplass,
} from "@sitedoc/shared";
import { hentDatabase } from "../db/database";
import { arbeidsdagLocal } from "../db/schema";
import { sisteBesok } from "../services/arbeidsdagBesok";
import {
  flettServerValg,
  manueltValg,
  nyesteInnsjekk,
  psiModulAktiv,
  type ValgtTid,
} from "../utils/byggeplassFilterValg";
import { hentByggeplasserNavLokalt } from "../services/tegningKatalog";
import { useFirma } from "./FirmaKontekst";
import { useAuth } from "../providers/AuthProvider";
import { trpc } from "../lib/trpc";
import {
  identifiserByggeplass,
  hentByggeplasserForProsjektLokalt,
} from "../services/byggeplassKatalog";

const BYGGEPLASS_MAP_KEY = "sitedoc_bygning_per_prosjekt";
// (22) En utgått streng-verdi fra før (22) i bygningMap leses som intet valg — av filteret
// (`manueltValg`) og av timer (`velgTimerByggeplass`), begge via `rensLagretByggeplassValg`.
// (22) Når hvert manuelle valg ble gjort + hva GPS viste da ({prosjektId: ValgtTid}).
// Egen nøkkel så bygningMap (delt med timer) beholder formatet.
const VALGT_TID_KEY = "sitedoc_byggeplass_valgt_tid";
// (22) Hvor ofte dagens siste timer-besøk leses lokalt (SQLite, billig).
const BESOK_LES_MS = 30_000;
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
//   (eldre versjoner kan ha lagret en utgått streng-verdi; den leses som intet valg). Én rad per prosjekt.
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
  /** (22) Filterets byggeplass: ny innsjekk → GPS → sist valgte (nyeste hendelse vinner),
   *  ellers null = «Velg byggeplass». Aldri «første». */
  valgtBygningId: string | null;
  /** (22) Prosjektet har minst én byggeplass (null = lista ikke kjent ennå). */
  harByggeplasser: boolean | null;
  /** (18) RETUR vilkår 2: byggeplass for Bekreft dag, innsjekk og ny timer-rad — lagret
   *  valg eller GPS, ellers null. Aldri (c) «første byggeplass» (som `valgtBygningId` kan være). */
  kontekstByggeplassId: string | null;
  /** Velg byggeplass. `prosjektId` (18) lagrer valget på det prosjektet i stedet for
   *  det aktive — den delte velgeren bytter prosjekt og byggeplass i samme trykk. */
  settBygning: (id: string, prosjektId?: string) => void;
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
  harByggeplasser: null,
  kontekstByggeplassId: null,
  settBygning: () => {},
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
  const [valgtTidMap, setValgtTidMap] = useState<Record<string, ValgtTid>>({});
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
        const [lagretBygning, lagretTegning, lagretFavoritt, lagretTid] = await Promise.all([
          hentVerdi(BYGGEPLASS_MAP_KEY),
          hentVerdi(SIST_TEGNING_MAP_KEY),
          hentVerdi(FAVORITT_KEY),
          hentVerdi(VALGT_TID_KEY),
        ]);
        if (lagretBygning) setBygningMap(JSON.parse(lagretBygning));
        if (lagretTid) setValgtTidMap(JSON.parse(lagretTid));
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
    // (22) Vent på lokal lasting — ellers overskriver lastingen det flettede resultatet.
    if (!data || serverMerget.current || lasterBygningId) return;
    serverMerget.current = true;
    // Kun rader med `projectId` satt teller — gamle globale fase-1-rader (projectId=null,
    // nøkler `sistByggeplassPerProsjekt`/`sistTegningPerByggeplass`) ignoreres bevisst.
    // verdi kommer som JSON-streng (se brukerinnstilling-router) — parse trygt.
    const nyBygg: Record<string, string> = {}; // {prosjektId: byggeplassId|sentinel}
    const nyTid: Record<string, ValgtTid> = {}; // (22) serverradens tid (`oppdatert`)
    const nyTegnFlat: Record<string, string> = {}; // flat cache {byggeplassId: tegningId}
    for (const rad of data) {
      if (!rad.projectId) continue;
      if (rad.nokkel === SERVER_NOKKEL_BYGGEPLASS) {
        try {
          // (22) Nyeste valg vinner: et lokalt valg skrevet etter serverraden (f.eks. offline,
          // ennå ikke synket) står. Før (22): serveren vant alltid.
          const serverTid = new Date(rad.oppdatert as unknown as string).getTime();
          const tid = Number.isFinite(serverTid) ? serverTid : 0;
          // GATE (49) V2: samme id som lokalt → behold lokale metadata (GPS ved valget).
          const serverId = JSON.parse(rad.verdi) as string;
          const meta = flettServerValg(bygningMap[rad.projectId], valgtTidMap[rad.projectId], serverId, tid);
          if (meta) {
            nyBygg[rad.projectId] = serverId;
            nyTid[rad.projectId] = meta;
          }
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
        const neste = { ...prev, ...nyBygg }; // nyeste vinner (filtrert over)
        lagreVerdi(BYGGEPLASS_MAP_KEY, JSON.stringify(neste)).catch(() => {});
        return neste;
      });
      setValgtTidMap((prev) => {
        const neste = { ...prev, ...nyTid };
        lagreVerdi(VALGT_TID_KEY, JSON.stringify(neste)).catch(() => {});
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
    // valgtTidMap og bygningMap leses bevisst kun ved flettingen (én gang pr. innlogging).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [innstillingerQuery.data, userId, lasterBygningId]);

  // (18) Prosjektets byggeplasser for standardvalget: server på nett (sortert på nummer),
  // ellers lokal katalog `byggeplass_nav_local`. React-query deduper mot velgerens kall.
  const byggeplassQuery = trpc.bygning.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId ?? "" },
    { enabled: !!valgtProsjektId },
  );
  const prosjektByggeplassIder = useMemo(() => {
    if (!valgtProsjektId) return [];
    const server = byggeplassQuery.data as { id: string }[] | undefined;
    if (server) return server.map((b) => b.id);
    if (!userId) return [];
    return hentByggeplasserNavLokalt(valgtProsjektId, userId).map((b) => b.id);
  }, [valgtProsjektId, byggeplassQuery.data, userId]);
  // (22) null = ukjent ennå (server laster, ingen lokal katalog) — da vises ikke «Velg byggeplass».
  const harByggeplasser = useMemo<boolean | null>(() => {
    if (!valgtProsjektId) return null;
    if (prosjektByggeplassIder.length > 0) return true;
    if (byggeplassQuery.data) return false;
    return byggeplassQuery.isError ? false : null;
  }, [valgtProsjektId, prosjektByggeplassIder, byggeplassQuery.data, byggeplassQuery.isError]);

  // (22) Innsjekk, kilde 1: PSI `minStatus` (kun når PSI-modulen er aktiv — kaster ellers).
  const modulQuery = trpc.modul.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId ?? "" },
    { enabled: !!valgtProsjektId },
  );
  const psiAktiv = psiModulAktiv(modulQuery.data as { moduleSlug: string; status?: string }[] | undefined);
  const psiStatus = trpc.mannskap.minStatus.useQuery(
    { projectId: valgtProsjektId ?? "" },
    { enabled: !!valgtProsjektId && psiAktiv, retry: false, staleTime: 60_000 },
  );
  // (22) Innsjekk, kilde 2: dagens siste timer-besøk (lokalt, kun lesing) på dette prosjektet.
  const [besokInnsjekk, setBesokInnsjekk] = useState<{ id: string | null; tid: number } | null>(null);
  useEffect(() => {
    if (!valgtProsjektId || !userId) {
      setBesokInnsjekk(null);
      return;
    }
    const les = () => {
      try {
        const db = hentDatabase();
        if (!db) return setBesokInnsjekk(null);
        const dag = db
          .select()
          .from(arbeidsdagLocal)
          .where(and(eq(arbeidsdagLocal.userId, userId), eq(arbeidsdagLocal.status, "paagaar")))
          .orderBy(desc(arbeidsdagLocal.startAt))
          .all()[0];
        const besok = dag ? sisteBesok(db, dag.id) : null;
        const tid = besok ? Date.parse(besok.ankomstAt) : Number.NaN;
        setBesokInnsjekk((forrige) => {
          const neste =
            besok && besok.prosjektId === valgtProsjektId && Number.isFinite(tid)
              ? { id: besok.byggeplassId ?? null, tid }
              : null;
          return forrige?.id === neste?.id && forrige?.tid === neste?.tid ? forrige : neste;
        });
      } catch {
        setBesokInnsjekk(null);
      }
    };
    les();
    const iv = setInterval(les, BESOK_LES_MS);
    const sub = AppState.addEventListener("change", (t) => {
      if (t === "active") les();
    });
    return () => {
      clearInterval(iv);
      sub.remove();
    };
  }, [valgtProsjektId, userId]);
  const innsjekk = useMemo(() => {
    const s = psiAktiv ? psiStatus.data : null;
    const psi = s
      ? { id: s.byggeplassId ?? null, tid: new Date(s.innsjekkTid as unknown as string).getTime() }
      : null;
    return nyesteInnsjekk([psi, besokInnsjekk]);
  }, [psiAktiv, psiStatus.data, besokInnsjekk]);

  // (22) Filterets byggeplass: ny innsjekk → GPS → sist valgte → null («Velg byggeplass»).
  // Nyeste hendelse vinner; et manuelt valg står til nyere innsjekk eller GPS-treff på en annen
  // byggeplass enn GPS viste da valget ble gjort. Aldri «første».
  // Avledet, ikke lagret — innsjekk og GPS skrives aldri som valg.
  const valgtBygningId = useMemo(() => {
    if (!valgtProsjektId || lasterBygningId) return null;
    return velgFilterByggeplass({
      byggeplassIder: prosjektByggeplassIder,
      innsjekk,
      gps: gpsByggeplassId,
      manuelt: manueltValg(bygningMap, valgtTidMap, valgtProsjektId),
    });
  }, [
    valgtProsjektId,
    lasterBygningId,
    prosjektByggeplassIder,
    innsjekk,
    gpsByggeplassId,
    bygningMap,
    valgtTidMap,
  ]);

  const kontekstByggeplassId = useMemo(() => {
    if (!valgtProsjektId || lasterBygningId) return null;
    const raa = bygningMap[valgtProsjektId] ?? null;
    return velgTimerByggeplass({
      byggeplassIder: prosjektByggeplassIder,
      lagret: raa,
      gpsNaermeste: gpsByggeplassId,
    });
  }, [valgtProsjektId, lasterBygningId, prosjektByggeplassIder, bygningMap, gpsByggeplassId]);

  // (18) `prosjektId` overstyrer det aktive prosjektet: den delte velgeren kaller
  // byttProsjekt(p) + settBygning(id, p) i samme trykk, før valgtProsjektId er oppdatert.
  // Lokal map og servermirror (sistBruktByggeplass) skrives da på p, ikke på det gamle.
  const settBygning = useCallback(
    (id: string, prosjektId?: string) => {
      const pid = prosjektId ?? valgtProsjektId;
      if (!pid) return;
      setBygningMap((prev) => {
        const neste = oppdaterBygningMap(prev, pid, id);
        lagreVerdi(BYGGEPLASS_MAP_KEY, JSON.stringify(neste)).catch(() => {});
        // Server: kun DETTE prosjektets rad (verdi = byggeplassId) — isolert konflikt.
        synkTilServer(SERVER_NOKKEL_BYGGEPLASS, id, pid);
        return neste;
      });
      // (22) Tidsstempel + hva GPS viste da (GPS på samme byggeplass overstyrer ikke valget).
      // GPS gjelder bare det aktive prosjektet.
      const gps = pid === valgtProsjektId ? gpsByggeplassId : null;
      setValgtTidMap((prev) => {
        const neste = { ...prev, [pid]: { tid: Date.now(), gps } };
        lagreVerdi(VALGT_TID_KEY, JSON.stringify(neste)).catch(() => {});
        return neste;
      });
    },
    [valgtProsjektId, synkTilServer, gpsByggeplassId],
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
            // (22) GPS lagres aldri som manuelt valg: merkes `auto` lokalt og speiles ikke
            // lenger til brukerminnet (der ville web og andre enheter lest det som valg).
            setValgtTidMap((p) => {
              const n = { ...p, [valgtProsjektId]: { tid: 0, auto: true } };
              lagreVerdi(VALGT_TID_KEY, JSON.stringify(n)).catch(() => {});
              return n;
            });
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
        harByggeplasser,
        kontekstByggeplassId,
        settBygning,
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
