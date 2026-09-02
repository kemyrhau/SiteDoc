import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  Platform,
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  MoreVertical,
  MapPin,
  Crosshair,
  Navigation,
  Eye,
  EyeOff,
  Check,
  X,
  ChevronDown,
  SlidersHorizontal,
} from "lucide-react-native";
import * as Location from "expo-location";
import { useTranslation } from "react-i18next";
import { trpc } from "../../src/lib/trpc";
import { useProsjekt } from "../../src/kontekst/ProsjektKontekst";
import { useByggeplass } from "../../src/kontekst/ByggeplassKontekst";
import { AUTH_CONFIG } from "../../src/config/auth";
import { KartVisning } from "../../src/components/KartVisning";
import { TegningsVisning } from "../../src/components/TegningsVisning";
import type { Markør, GpsMarkør, Omrade } from "../../src/components/TegningsVisning";
import { TegningsVelger } from "../../src/components/TegningsVelger";
import { OppgaveModal } from "../../src/components/OppgaveModal";
import { MalVelger } from "../../src/components/MalVelger";
import { PeriodeFilter } from "../../src/components/PeriodeFilter";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  beregnTransformasjon,
  gpsTilTegning,
  effektiveGrenser,
  innenforPeriode,
  avledPunktTilstand,
  isoUkeRef,
} from "@sitedoc/shared/utils";
import type { GeoReferanse, Periode } from "@sitedoc/shared";

// Type-casts for å unngå TS2589 (excessively deep type instantiation)
interface BygningData {
  id: string;
  name: string;
  status: string;
  type?: string;
}

interface TegningData {
  id: string;
  name: string;
  drawingNumber: string | null;
  discipline: string | null;
  floor: string | null;
  byggeplassId: string | null;
  fileUrl: string | null;
  geoReference?: unknown;
  _count: { revisions: number };
}

interface TegningDetalj {
  id: string;
  name: string;
  fileUrl: string | null;
  fileType?: string | null;
  geoReference?: unknown;
  pdfPageSize?: { width: number; height: number } | null;
}

interface OppgaveMarkør {
  id: string;
  number: number;
  positionX: number;
  positionY: number;
  status: string;
  createdAt?: string;
  template: { prefix: string | null } | null;
}

interface KontrollpunktMarkør {
  id: string;
  positionX: number | null;
  positionY: number | null;
  status: string;
  fristUke: number | null;
  fristAar: number | null;
  varselUkerFor: number;
  opprettet?: string;
  sjekkliste: { id: string; status: string } | null;
  sjekklisteMal: { prefix: string | null; name: string } | null;
  omrade: { navn: string } | null;
}

interface OmradeData {
  id: string;
  navn: string;
  farge: string;
  polygon: unknown;
}

export default function LokasjonerSkjerm() {
  const { t } = useTranslation();
  const { valgtProsjektId } = useProsjekt();
  const { valgtBygningId, erHeleProsjektet, settBygning, settSistTegning } = useByggeplass();
  const [valgtTegningId, setValgtTegningId] = useState<string | null>(null);

  const router = useRouter();

  // Del A pkt 1 — dyplenke fra Tegninger-fanen: åpne trykket tegning direkte.
  const params = useLocalSearchParams<{
    tegningId?: string;
    byggeplassId?: string;
    ts?: string;
  }>();
  // Sist håndterte navigasjon (nonce). Sikrer at hver dyplenke-navigasjon åpner
  // tegningen én gang — ikke på nytt ved re-render eller ren tab-veksling.
  const sistParamTsRef = useRef<string | null>(null);

  // Modus: visning (standard) eller plassering (opprett oppgave)
  const [plasseringsmodus, setPlasseringsmodus] = useState(false);

  // Markør- og oppgavemodal-state
  const [markørPosisjon, setMarkørPosisjon] = useState<{ x: number; y: number } | null>(null);
  const [visOppgaveModal, setVisOppgaveModal] = useState(false);
  const [visMalVelger, setVisMalVelger] = useState(false);
  const [valgtMalId, setValgtMalId] = useState<string | null>(null);

  // Lagfiltre (paritet med web-tegningssiden): oppgaver + kontrollpunkter + områder, alle på.
  const [visOppgaver, setVisOppgaver] = useState(true);
  const [visKontrollpunkter, setVisKontrollpunkter] = useState(true);
  const [visOmrader, setVisOmrader] = useState(true);
  // Periodefilter på markørene (createdAt/opprettet). Standard: alle.
  const [periode, setPeriode] = useState<Periode>({ hurtigvalg: "alle", fra: null, til: null });
  // Sammenleggbart filterpanel (skjult som standard — renere skjerm).
  const [visFilter, setVisFilter] = useState(false);

  // Hent alle bygninger for valgt prosjekt
  const bygningQuery = trpc.bygning.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId },
  );

  // Hent tegninger for valgt prosjekt
  const tegningQuery = trpc.tegning.hentForProsjekt.useQuery(
    {
      projectId: valgtProsjektId!,
      ...(valgtBygningId ? { byggeplassId: valgtBygningId } : {}),
    },
    { enabled: !!valgtProsjektId },
  );

  // Hent detaljer for valgt tegning
  const valgtTegningQuery = trpc.tegning.hentMedId.useQuery(
    { id: valgtTegningId! },
    { enabled: !!valgtTegningId },
  );

  // Hent eksisterende oppgaver for valgt tegning
  const oppgaverQuery = trpc.oppgave.hentForTegning.useQuery(
    { drawingId: valgtTegningId! },
    { enabled: !!valgtTegningId },
  );

  // Kontrollpunkt-markører for valgt tegning (paritet med web).
  const kontrollpunktQuery = trpc.kontrollplan.hentForTegning.useQuery(
    { drawingId: valgtTegningId! },
    { enabled: !!valgtTegningId },
  );

  // Områder (soner/rom/etasjer) for valgt tegning.
  const omradeQuery = trpc.omrade.hentForTegning.useQuery(
    { tegningId: valgtTegningId! },
    { enabled: !!valgtTegningId },
  );

  // Cast data
  const bygninger = (bygningQuery.data ?? []) as BygningData[];
  const tegninger = (tegningQuery.data ?? []) as TegningData[];
  const valgtTegningDetalj = valgtTegningQuery.data as TegningDetalj | undefined;
  const eksisterendeOppgaver = (oppgaverQuery.data ?? []) as OppgaveMarkør[];
  const kontrollpunktMarkører = (kontrollpunktQuery.data ?? []) as KontrollpunktMarkør[];
  const tegningOmrader = (omradeQuery.data ?? []) as OmradeData[];

  // Auto-velg første bygning hvis ingen er valgt (og ingen dyplenke satte den).
  // MEN ikke når brukeren eksplisitt valgte «Hele prosjektet» — da ville dette
  // skjult-skrive en byggeplass til den globale konteksten og slå filteret på
  // igjen på tvers av alle skjermer (nøyaktig feilen vi retter).
  useEffect(() => {
    if (!valgtBygningId && !erHeleProsjektet && bygninger.length > 0 && bygninger[0]) {
      settBygning(bygninger[0].id);
    }
  }, [valgtBygningId, erHeleProsjektet, bygninger, settBygning]);

  const lasterData = bygningQuery.isLoading || tegningQuery.isLoading;

  // Finn valgt tegning fra listen
  const valgtTegning = useMemo(
    () => tegninger.find((t) => t.id === valgtTegningId),
    [tegninger, valgtTegningId],
  );

  // Stabil georeferanse
  const harGeoRef = !!valgtTegningDetalj?.geoReference;
  const geoRefStringifisert = useMemo(
    () => (valgtTegningDetalj?.geoReference ? JSON.stringify(valgtTegningDetalj.geoReference) : null),
    [valgtTegningDetalj?.geoReference],
  );

  // Periodefilter-grenser + dagens ISO-uke (til kontrollpunkt-tilstand).
  const { fra: pFra, til: pTil } = effektiveGrenser(periode);
  const naaUke = useMemo(() => isoUkeRef(new Date()), []);

  // Bygg markørliste: oppgaver (grønn) + kontrollpunkter (tilstandsfarget) + ny markør.
  // Begge lag periodefiltreres på createdAt/opprettet og styres av hver sin vis-bryter.
  // Georef-punktene (P1/P2/P3) vises IKKE her — de er konfigurasjon (georef-editoren).
  const markører: Markør[] = useMemo(() => {
    const liste: Markør[] = [];

    // Oppgaver
    if (visOppgaver) {
      for (const o of eksisterendeOppgaver) {
        if (o.positionX == null || o.positionY == null) continue;
        if (o.createdAt && !innenforPeriode(new Date(o.createdAt), pFra, pTil)) continue;
        liste.push({
          id: o.id,
          x: o.positionX,
          y: o.positionY,
          farge: "#10b981",
          fylt: true,
          label: `${o.template?.prefix ?? ""}${o.template?.prefix ? "-" : ""}${String(o.number).padStart(3, "0")}`,
        });
      }
    }

    // Kontrollpunkter — farge/form fra avledet tilstand (samme modell som web liste/rutenett).
    if (visKontrollpunkter) {
      for (const p of kontrollpunktMarkører) {
        if (p.positionX == null || p.positionY == null) continue;
        if (p.opprettet && !innenforPeriode(new Date(p.opprettet), pFra, pTil)) continue;
        const tilstand = avledPunktTilstand(p, naaUke);
        const navn = p.sjekklisteMal
          ? p.sjekklisteMal.prefix
            ? `${p.sjekklisteMal.prefix} — ${p.sjekklisteMal.name}`
            : p.sjekklisteMal.name
          : "";
        liste.push({
          id: `kp:${p.id}`,
          x: p.positionX,
          y: p.positionY,
          farge: tilstand.farge,
          fylt: tilstand.fylt,
          kantFarge: tilstand.overFrist ? "#ef4444" : tilstand.fylt ? "#ffffff" : tilstand.farge,
          label: navn,
        });
      }
    }

    if (markørPosisjon) {
      liste.push({
        id: "ny-oppgave",
        x: markørPosisjon.x,
        y: markørPosisjon.y,
        farge: "#10b981",
        fylt: true,
      });
    }

    return liste;
  }, [eksisterendeOppgaver, kontrollpunktMarkører, markørPosisjon, visOppgaver, visKontrollpunkter, pFra, pTil, naaUke]);

  // Områder (polygoner) — normaliser polygon-json til {x,y}[]; tomt/for få punkter → dropp.
  const omrader: Omrade[] = useMemo(() => {
    if (!visOmrader) return [];
    return tegningOmrader
      .map((o) => {
        const rå = Array.isArray(o.polygon) ? o.polygon : [];
        const punkter = rå
          .filter((p): p is { x: number; y: number } => !!p && typeof p === "object" && "x" in p && "y" in p)
          .map((p) => ({ x: Number(p.x), y: Number(p.y) }));
        return { id: o.id, navn: o.navn, farge: o.farge || "#3b82f6", polygon: punkter };
      })
      .filter((o) => o.polygon.length >= 3);
  }, [tegningOmrader, visOmrader]);

  // GPS-status
  const [gpsStatus, setGpsStatus] = useState<"venter" | "ingen_tillatelse" | "aktiv" | "feil" | "ugyldig_georef" | null>(null);

  // GPS-posisjon på tegning (kontinuerlig sporing for georefererte tegninger)
  const [gpsMarkør, setGpsMarkør] = useState<GpsMarkør | null>(null);
  const [gpsDebug, setGpsDebug] = useState<string | null>(null);
  const gpsAbonnementRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    if (!harGeoRef || !geoRefStringifisert || !valgtTegningId) {
      setGpsMarkør(null);
      setGpsStatus(null);
      return;
    }

    let aktiv = true;
    setGpsStatus("venter");

    async function startSporing() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!aktiv) return;
        if (status !== "granted") {
          setGpsStatus("ingen_tillatelse");
          return;
        }

        const geoRef = JSON.parse(geoRefStringifisert!) as GeoReferanse;

        // Valider at referansepunktene har ulike GPS-koordinater
        if (
          geoRef.point1.gps.lat === geoRef.point2.gps.lat &&
          geoRef.point1.gps.lng === geoRef.point2.gps.lng
        ) {
          console.warn("[GPS-LOK] Ugyldig georeferanse: identiske GPS-punkter");
          setGpsStatus("ugyldig_georef");
          return;
        }

        const transformasjon = beregnTransformasjon(geoRef);

        // Hent fersk GPS-posisjon (skip getLastKnown — kan være fra annen lokasjon)
        console.log("[GPS-LOK] Henter fersk GPS (High, 10s timeout)...");
        let initialPosisjon = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000)),
        ]);
        console.log("[GPS-LOK] High resultat:", initialPosisjon ? `OK (±${initialPosisjon.coords.accuracy?.toFixed(0)}m)` : "timeout");
        if (!aktiv) return;
        if (!initialPosisjon) {
          console.log("[GPS-LOK] Prøver Balanced (8s timeout)...");
          initialPosisjon = await Promise.race([
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
          ]);
          console.log("[GPS-LOK] Balanced resultat:", initialPosisjon ? `OK (±${initialPosisjon.coords.accuracy?.toFixed(0)}m)` : "timeout");
          if (!aktiv) return;
        }
        if (!initialPosisjon) {
          console.warn("[GPS-LOK] Alle GPS-forsøk feilet");
          setGpsStatus("feil");
          return;
        }
        console.log("[GPS-LOK] GPS:", initialPosisjon.coords.latitude.toFixed(6), initialPosisjon.coords.longitude.toFixed(6), "±" + (initialPosisjon.coords.accuracy?.toFixed(0) ?? "?") + "m");
        const initialGps = {
          lat: initialPosisjon.coords.latitude,
          lng: initialPosisjon.coords.longitude,
        };
        const initialPunkt = gpsTilTegning(initialGps, transformasjon);
        console.log("[GPS-LOK] → pixel:", initialPunkt.x.toFixed(1), initialPunkt.y.toFixed(1));
        setGpsMarkør({ x: initialPunkt.x, y: initialPunkt.y });
        setGpsDebug(`${initialGps.lat.toFixed(6)}, ${initialGps.lng.toFixed(6)} ±${initialPosisjon.coords.accuracy?.toFixed(0) ?? "?"}m → (${initialPunkt.x.toFixed(1)}, ${initialPunkt.y.toFixed(1)})`);
        setGpsStatus("aktiv");

        // Kontinuerlig sporing med høy nøyaktighet
        gpsAbonnementRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 1,
            timeInterval: 2000,
          },
          (lokasjon) => {
            if (!aktiv) return;
            const gps = {
              lat: lokasjon.coords.latitude,
              lng: lokasjon.coords.longitude,
            };
            const acc = lokasjon.coords.accuracy?.toFixed(0) ?? "?";
            console.log("[GPS-LOK] Oppdatering:", gps.lat.toFixed(6), gps.lng.toFixed(6), "±" + acc + "m");
            const posisjon = gpsTilTegning(gps, transformasjon);
            setGpsMarkør({ x: posisjon.x, y: posisjon.y });
            setGpsDebug(`${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)} ±${acc}m → (${posisjon.x.toFixed(1)}, ${posisjon.y.toFixed(1)})`);
          },
        );
      } catch (feil) {
        console.warn("GPS-sporing feilet:", feil);
        if (aktiv) setGpsStatus("feil");
      }
    }

    startSporing();

    return () => {
      aktiv = false;
      if (gpsAbonnementRef.current) {
        gpsAbonnementRef.current.remove();
        gpsAbonnementRef.current = null;
      }
      setGpsMarkør(null);
      setGpsStatus(null);
    };
  }, [harGeoRef, geoRefStringifisert, valgtTegningId]);

  // Bygningsvelger — nedtrekksmeny (alltid én aktiv bygning)
  const visBygningsvelger = useCallback(() => {
    if (bygninger.length <= 1) return;
    const alternativ = [...bygninger.map((b) => b.name), t("handling.avbryt")];
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: alternativ,
          cancelButtonIndex: alternativ.length - 1,
          title: t("lokasjoner.velgBygning"),
        },
        (indeks) => {
          if (indeks < alternativ.length - 1) {
            const valgt = bygninger[indeks];
            if (valgt) settBygning(valgt.id);
          }
        },
      );
    } else {
      Alert.alert(
        t("lokasjoner.velgBygning"),
        undefined,
        [
          ...bygninger.map((b) => ({
            text: b.name,
            onPress: () => settBygning(b.id),
          })),
          { text: t("handling.avbryt"), style: "cancel" as const },
        ],
      );
    }
  }, [bygninger, settBygning]);

  // Treprikk-meny
  const visTreprikkmeny = useCallback(() => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [
            t("handling.avbryt"),
            t("lokasjoner.tegningsinformasjon"),
            t("lokasjoner.forberedOffline"),
            t("lokasjoner.oppdatereOppgaver"),
          ],
          cancelButtonIndex: 0,
        },
        (indeks) => {
          if (indeks === 1) {
            // Tegningsinformasjon
          } else if (indeks === 2) {
            // Forbered til offline
          } else if (indeks === 3) {
            // Oppdatere oppgaver
          }
        },
      );
    }
  }, []);

  // Håndter tegningsvalg
  const håndterVelgTegning = useCallback(
    (id: string, byggeplassIdForPersist?: string | null) => {
      setValgtTegningId(id);
      setMarkørPosisjon(null);
      setPlasseringsmodus(false);
      // Del A pkt 2 — persister sist valgte tegning for byggeplassen (F1-minnet).
      // Skrives ved HVERT tegningsvalg. Ved dyplenke sendes byggeplass-id-en
      // eksplisitt (settBygning-oppdateringen er ikke synlig i denne closuren
      // ennå), ellers brukes aktiv byggeplass fra velger-flyten. Uten kjent
      // byggeplass hoppes lagringen over (F1 er per-byggeplass-nøklet).
      const byggForPersist = byggeplassIdForPersist ?? valgtBygningId;
      if (byggForPersist) settSistTegning(byggForPersist, id);
    },
    [valgtBygningId, settSistTegning],
  );

  // Del A pkt 1 — åpne tegning direkte fra route-param (dyplenke fra Tegninger-
  // fanen / «Fortsett i …»-snarveien). Kjøres én gang per navigasjon (nonce):
  //  - byggeplass-id fra param settes først, så velgeren/lista står på riktig
  //    byggeplass om brukeren avbryter,
  //  - tegning-id settes som valgt; detaljene hentes via hentMedId.
  // Guard: hentMedId kaster for slettet tegning (findUniqueOrThrow) og for
  // tegning i annet prosjekt (verifiserProsjektmedlem) → valgtTegningDetalj blir
  // undefined → `visserTegning` er false → KartVisning + bottom-sheet-velgeren
  // vises (graceful fallback, aldri krasj/blank). Bottom-sheet-velgeren er alltid
  // montert, så UI er brukbart umiddelbart mens detaljene lastes.
  useEffect(() => {
    const tegningId = params.tegningId;
    if (!tegningId) return;
    const ts = params.ts ?? tegningId;
    if (sistParamTsRef.current === ts) return;
    sistParamTsRef.current = ts;
    if (params.byggeplassId) settBygning(params.byggeplassId);
    håndterVelgTegning(tegningId, params.byggeplassId ?? null);
  }, [
    params.tegningId,
    params.byggeplassId,
    params.ts,
    settBygning,
    håndterVelgTegning,
  ]);

  // Håndter lukking av tegning
  const håndterLukkTegning = useCallback(() => {
    setValgtTegningId(null);
    setMarkørPosisjon(null);
    setPlasseringsmodus(false);
  }, []);

  // Håndter avbryt i bottom sheet
  const håndterAvbryt = useCallback(() => {
    setValgtTegningId(null);
    setMarkørPosisjon(null);
    setPlasseringsmodus(false);
  }, []);

  // Håndter trykk på tegning — plasser markør uten å åpne modal
  const håndterTegningTrykk = useCallback(
    (posX: number, posY: number) => {
      setMarkørPosisjon({ x: posX, y: posY });
    },
    [],
  );

  // Bruk GPS-posisjon som markørposisjon
  const brukGpsPosisjon = useCallback(() => {
    if (gpsMarkør) {
      setMarkørPosisjon({ x: gpsMarkør.x, y: gpsMarkør.y });
    } else {
      Alert.alert(t("lokasjoner.gpsIkkeTilgjengelig"), t("lokasjoner.venterPaaGps"));
    }
  }, [gpsMarkør]);

  // Bekreft markørposisjon → åpne malvelger
  const bekreftPosisjon = useCallback(() => {
    if (markørPosisjon) {
      setVisMalVelger(true);
    }
  }, [markørPosisjon]);

  // Avbryt markørplassering
  const avbrytMarkør = useCallback(() => {
    setMarkørPosisjon(null);
  }, []);

  // Håndter trykk på eksisterende markør. Kontrollpunkt-markører har `kp:`-prefiks:
  // koblet sjekkliste → åpne den; uten kobling (ennå ikke startet) → informativ melding
  // (mobil har ingen kontrollplan-oversikt å falle til, slik web gjør — men et stille
  // `return` etterlot tappen uten respons). Oppgave-markører → åpne oppgaven.
  const håndterMarkørTrykk = useCallback((markørId: string) => {
    if (markørId === "ny-oppgave") return;
    if (markørId.startsWith("kp:")) {
      const punktId = markørId.slice(3);
      const punkt = kontrollpunktMarkører.find((p) => p.id === punktId);
      if (punkt?.sjekkliste?.id) {
        router.push(`/sjekkliste/${punkt.sjekkliste.id}`);
      } else {
        Alert.alert(t("lokasjoner.punktUtenSjekklisteTittel"), t("lokasjoner.punktUtenSjekkliste"));
      }
      return;
    }
    router.push(`/oppgave/${markørId}`);
  }, [router, kontrollpunktMarkører, t]);

  // Håndter oppgave opprettet
  const håndterOppgaveOpprettet = useCallback((oppgaveId: string) => {
    setVisOppgaveModal(false);
    setVisMalVelger(false);
    setValgtMalId(null);
    setMarkørPosisjon(null);
    setPlasseringsmodus(false);
    router.push(`/oppgave/${oppgaveId}`);
  }, [router]);

  // Håndter lukking av oppgavemodal
  const håndterLukkOppgaveModal = useCallback(() => {
    setVisOppgaveModal(false);
    setVisMalVelger(false);
    setValgtMalId(null);
    setMarkørPosisjon(null);
  }, []);

  // Ingen prosjekt valgt
  if (!valgtProsjektId) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
        <View className="flex-1 items-center justify-center px-8">
          <MapPin size={48} color="#9ca3af" />
          <Text className="mt-4 text-base font-medium text-gray-500">
            {t("lokasjoner.tittel")}
          </Text>
          <Text className="mt-2 text-center text-sm text-gray-400">
            {t("lokasjoner.velgProsjekt")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const visserTegning = !!valgtTegningId && !!valgtTegningDetalj?.fileUrl;

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      {/* Blå header */}
      <View className="flex-row items-center justify-between bg-sitedoc-blue px-4 py-3">
        <Pressable onPress={visBygningsvelger} className="flex-row items-center gap-1.5" disabled={bygninger.length <= 1}>
          <View>
            <Text className="text-sm font-semibold text-white" numberOfLines={1}>
              {valgtBygningId
                ? bygninger.find((b) => b.id === valgtBygningId)?.name ?? t("lokasjoner.velgBygning")
                : t("lokasjoner.velgBygning")}
            </Text>
            <Text className="text-[10px] text-blue-200">{t("lokasjoner.tittel")}</Text>
          </View>
          {bygninger.length > 1 && <ChevronDown size={14} color="#93c5fd" />}
        </Pressable>
        <View className="flex-row items-center gap-3">
          {/* Plasseringsmodus-toggle (kun når tegning vises) */}
          {visserTegning && (
            <Pressable
              onPress={() => {
                setPlasseringsmodus(!plasseringsmodus);
                if (plasseringsmodus) setMarkørPosisjon(null);
              }}
              hitSlop={8}
              className={`rounded-full px-3 py-1 ${plasseringsmodus ? "bg-white" : "bg-white/20"}`}
            >
              <View className="flex-row items-center gap-1.5">
                {plasseringsmodus ? (
                  <Crosshair size={14} color="#1e40af" />
                ) : (
                  <Navigation size={14} color="#ffffff" />
                )}
                <Text className={`text-xs font-medium ${plasseringsmodus ? "text-sitedoc-blue" : "text-white"}`}>
                  {plasseringsmodus ? t("lokasjoner.plassering") : t("lokasjoner.navigering")}
                </Text>
              </View>
            </Pressable>
          )}
          <Pressable onPress={visTreprikkmeny} hitSlop={12}>
            <MoreVertical size={20} color="#ffffff" />
          </Pressable>
        </View>
      </View>

      {/* GPS-status-banner (kun for georefererte tegninger med problemer) */}
      {visserTegning && harGeoRef && gpsStatus === "ingen_tillatelse" && (
        <Pressable
          onPress={() => Linking.openSettings()}
          className="flex-row items-center justify-between bg-red-50 px-4 py-2"
        >
          <View className="flex-1">
            <Text className="text-xs font-medium text-red-700">
              {t("lokasjoner.gpsTillatelse")}
            </Text>
            <Text className="text-xs text-red-600">
              {t("lokasjoner.gpsTillatelseInfo")}
            </Text>
          </View>
          <MapPin size={16} color="#dc2626" />
        </Pressable>
      )}
      {visserTegning && harGeoRef && gpsStatus === "ugyldig_georef" && (
        <View className="flex-row items-center gap-2 bg-amber-50 px-4 py-2">
          <Text className="flex-1 text-xs text-amber-700">
            {t("lokasjoner.ugyldigGeoref")}
          </Text>
        </View>
      )}
      {visserTegning && harGeoRef && gpsStatus === "feil" && (
        <View className="flex-row items-center gap-2 bg-amber-50 px-4 py-2">
          <Text className="flex-1 text-xs text-amber-700">
            {t("lokasjoner.gpsUtilgjengelig")}
          </Text>
        </View>
      )}
      {visserTegning && harGeoRef && gpsStatus === "venter" && (
        <View className="flex-row items-center gap-2 bg-blue-50 px-4 py-2">
          <ActivityIndicator size="small" color="#1e40af" />
          <Text className="text-xs text-blue-700">{t("lokasjoner.henterGps")}</Text>
        </View>
      )}
      {visserTegning && harGeoRef && gpsDebug && gpsStatus === "aktiv" && (
        <View className="bg-gray-100 px-4 py-1">
          <Text className="text-[10px] text-gray-500">{gpsDebug}</Text>
        </View>
      )}

      {/* Plasseringsmodus-banner */}
      {visserTegning && plasseringsmodus && (
        <View className="bg-amber-50 px-4 py-2">
          <View className="flex-row items-center justify-between">
            {markørPosisjon ? (
              <>
                <Text className="text-xs text-amber-700">
                  {t("lokasjoner.verifiserPosisjon")}
                </Text>
                <View className="flex-row items-center gap-2">
                  <Pressable
                    onPress={avbrytMarkør}
                    className="flex-row items-center gap-1 rounded-full bg-gray-200 px-2.5 py-1"
                  >
                    <X size={12} color="#6b7280" />
                    <Text className="text-xs font-medium text-gray-600">{t("handling.flytt")}</Text>
                  </Pressable>
                  <Pressable
                    onPress={bekreftPosisjon}
                    className="flex-row items-center gap-1 rounded-full bg-green-600 px-3 py-1"
                  >
                    <Check size={12} color="#ffffff" />
                    <Text className="text-xs font-medium text-white">{t("handling.bekreft")}</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text className="text-xs text-amber-700">
                  {t("lokasjoner.trykkPaaTegning")}
                </Text>
                {harGeoRef && gpsMarkør && (
                  <Pressable
                    onPress={brukGpsPosisjon}
                    className="flex-row items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1"
                  >
                    <Crosshair size={12} color="#1e40af" />
                    <Text className="text-xs font-medium text-blue-700">{t("lokasjoner.brukGps")}</Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
        </View>
      )}

      {/* Lag- og periodefilter (paritet med web-tegningssiden) — sammenleggbart, kun når tegning vises */}
      {visserTegning && (
        <View className="border-b border-gray-200 bg-white">
          <Pressable
            onPress={() => setVisFilter((v) => !v)}
            className="flex-row items-center justify-between px-4 py-2"
          >
            <View className="flex-row items-center gap-1.5">
              <SlidersHorizontal size={14} color="#6b7280" />
              <Text className="text-xs font-medium text-gray-600">{t("lokasjoner.filter")}</Text>
            </View>
            <ChevronDown
              size={16}
              color="#9ca3af"
              style={{ transform: [{ rotate: visFilter ? "180deg" : "0deg" }] }}
            />
          </Pressable>
          {visFilter && (
            <View className="gap-2.5 px-4 pb-3">
              {/* Lag-brytere */}
              <View className="flex-row flex-wrap gap-2">
                {([
                  ["oppgaver", visOppgaver, setVisOppgaver, "#10b981"],
                  ["kontrollpunkter", visKontrollpunkter, setVisKontrollpunkter, "#3b82f6"],
                  ["omrader", visOmrader, setVisOmrader, "#6b7280"],
                ] as const).map(([nøkkel, på, sett, farge]) => (
                  <Pressable
                    key={nøkkel}
                    onPress={() => sett((v) => !v)}
                    className={`flex-row items-center gap-1.5 rounded-full border px-2.5 py-1 ${på ? "border-gray-300 bg-gray-50" : "border-gray-200 bg-white"}`}
                  >
                    {på ? <Eye size={12} color={farge} /> : <EyeOff size={12} color="#9ca3af" />}
                    <Text className={`text-xs ${på ? "text-gray-700" : "text-gray-400"}`}>
                      {t(`lokasjoner.lag.${nøkkel}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {/* Periodefilter */}
              <PeriodeFilter periode={periode} onEndre={setPeriode} />
            </View>
          )}
        </View>
      )}

      {/* Hovedinnhold */}
      <View className="flex-1">
        {lasterData ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#1e40af" />
            <Text className="mt-3 text-sm text-gray-500">
              {t("lokasjoner.henterData")}
            </Text>
          </View>
        ) : visserTegning ? (
          <TegningsVisning
            tegningUrl={
              valgtTegningDetalj!.fileUrl!.startsWith("http")
                ? valgtTegningDetalj!.fileUrl!
                : `${AUTH_CONFIG.apiUrl}${valgtTegningDetalj!.fileUrl}`
            }
            tegningNavn={valgtTegningDetalj!.name}
            onLukk={håndterLukkTegning}
            onTrykk={plasseringsmodus ? håndterTegningTrykk : undefined}
            onMarkørTrykk={håndterMarkørTrykk}
            markører={markører}
            omrader={omrader}
            gpsMarkør={gpsMarkør}
            pdfPageSize={valgtTegningDetalj?.pdfPageSize ?? undefined}
          />
        ) : (
          <KartVisning />
        )}
      </View>

      {/* Bottom sheet tegningsvelger */}
      <TegningsVelger
        bygninger={bygninger}
        tegninger={tegninger}
        valgtBygningId={valgtBygningId}
        valgtTegningId={valgtTegningId}
        onVelgBygning={(id) => { if (id) settBygning(id); }}
        onVelgTegning={håndterVelgTegning}
        onAvbryt={håndterAvbryt}
        laster={lasterData}
      />

      {/* Malvelger for oppgave fra tegning */}
      <MalVelger
        synlig={visMalVelger && !valgtMalId}
        kategori="oppgave"
        onVelg={(mal) => {
          setValgtMalId(mal.id);
          setVisMalVelger(false);
          setVisOppgaveModal(true);
        }}
        onLukk={() => {
          setVisMalVelger(false);
          setMarkørPosisjon(null);
        }}
      />

      {/* Oppgave-opprettelsesmodal */}
      {valgtTegningId && valgtTegning && markørPosisjon && valgtMalId && (
        <OppgaveModal
          synlig={visOppgaveModal}
          onLukk={håndterLukkOppgaveModal}
          onOpprettet={håndterOppgaveOpprettet}
          tegningNavn={valgtTegning.drawingNumber || valgtTegning.name}
          tegningId={valgtTegningId}
          posisjonX={markørPosisjon.x}
          posisjonY={markørPosisjon.y}
          gpsPositionert={harGeoRef}
          templateId={valgtMalId}
        />
      )}
    </SafeAreaView>
  );
}
