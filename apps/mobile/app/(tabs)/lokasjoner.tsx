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
  CloudDownload,
  CloudCheck,
  CloudOff,
  Layers,
} from "lucide-react-native";
import * as Location from "expo-location";
import { useTranslation } from "react-i18next";
import type { EgenskapsFelt, RegisterVerdenLagInfo } from "@sitedoc/shared";
import { trpc } from "../../src/lib/trpc";
import { useProsjekt } from "../../src/kontekst/ProsjektKontekst";
import { useByggeplass } from "../../src/kontekst/ByggeplassKontekst";
import { useNettverk } from "../../src/providers/NettverkProvider";
import { useAuth } from "../../src/providers/AuthProvider";
import { AUTH_CONFIG, erTestLoginAktiv } from "../../src/config/auth";
import { DxfViewerTegningMobil, type DxfViewerTegningMobilRef } from "../../src/components/DxfViewerTegningMobil";
import { DxfMaleVerktoylinje } from "../../src/components/DxfMaleVerktoylinje";
import { TegningEgenskapsArk } from "../../src/components/TegningEgenskapsArk";
import { TegningLagPanel } from "../../src/components/TegningLagPanel";
import { hentSkjulteLag, lagreSkjulteLag, byggSynlighetFraSkjulte, utledSkjulteLag } from "../../src/lib/lagSynlighetLagring";
import {
  forberedTegning,
  erTegningForberedt,
  hentTegningKilde,
  type TegningKilde,
} from "../../src/services/offlineKlargjoring";
import {
  refreshTegningKatalog,
  refreshByggeplassNavKatalog,
  lagreTegningDetaljSpeil,
  lagreTegningDetaljFraData,
  hentTegningerLokalt,
  hentTegningDetaljLokalt,
  hentByggeplasserNavLokalt,
} from "../../src/services/tegningKatalog";
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
  // Mobilvariant (ezdxf) — den som faktisk vises/caches for DWG. Scalar fra hentForProsjekt.
  mobilFileUrl?: string | null;
  fileType?: string | null;
  geoReference?: unknown;
  _count: { revisions: number };
}

interface TegningDetalj {
  id: string;
  name: string;
  fileUrl: string | null;
  // L1: mobil-variant (ezdxf hatch=solid). null = bruk fileUrl (egen/ikke-DWG).
  mobilFileUrl?: string | null;
  fileType?: string | null;
  geoReference?: unknown;
  pdfPageSize?: { width: number; height: number } | null;
  // Måledata (samme kilder som web) — returneres allerede av tegning.hentMedId.
  mmPrPiksel?: number | null;
  scale?: string | null;
  scaleKilde?: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
  // RETUR 2: auto-rotasjon (bakt inn i SVG-en) + brukeroverstyring. `startutsnitt` er
  // Json? på server. L4b: mobilen åpner nå zoomet på startutsnittet (bygget), ikke
  // fit-to-width — sendes til TegningsVisning (se startutsnitt-prop under).
  autoRotasjon?: number | null;
  rotasjonOverstyrt?: number | null;
  startutsnitt?: unknown;
  // Mobil leveranse 2 (arbeidstegning-f1): satt når konverteringen har produsert
  // dxf-viewer-artefakter. Begge eller ingen (dwgKonvertering.ts).
  dxfViewerFileUrl?: string | null;
  registerWorldUrl?: string | null;
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
  const { erPaaNettet } = useNettverk();
  const { bruker } = useAuth();
  const brukerId = bruker?.id;
  const [valgtTegningId, setValgtTegningId] = useState<string | null>(null);

  // Offline tegningsvisning (ordre fix/offline-tegning): lokal kopi FØR nett.
  // `tegningKilde` er resolvert kilde (data-URI lokal / nett-URL / utilgjengelig).
  const [tegningKilde, setTegningKilde] = useState<TegningKilde | null>(null);
  const [kildeLaster, setKildeLaster] = useState(false);
  // Offline-status for den valgte tegningen (lagret / ikke lagret) + pågående nedlasting.
  const [forberedt, setForberedt] = useState<boolean | null>(null);
  const [forbereder, setForbereder] = useState(false);
  const [offlineMelding, setOfflineMelding] = useState<string | null>(null);
  // RETUR leveranse 2 (Kontrollør, punkt 2): WebView-last-feil/tidsgrense i
  // DxfViewerTegningMobil faller hit ned til den eksisterende SVG-veien, i
  // stedet for å la en evig spinner stå. Nullstilles når brukeren velger en
  // annen tegning, så et nytt forsøk kan skje neste gang.
  const [dxfViewerFeilet, setDxfViewerFeilet] = useState(false);
  // Leveranse 3+4: måleverktøyet i WebGL-grenen — toolbar og WebView-bro, se
  // DxfMaleVerktoylinje/DxfViewerTegningMobil sine filheadere for protokollen.
  const dxfViewerRef = useRef<DxfViewerTegningMobilRef>(null);
  const [dxfKanMale, setDxfKanMale] = useState(false);
  // F1+F2 (mobilplanen, "mobilplanen er godkjent i sin helhet", 2026-10-17): native
  // RN-paneler drevet av DxfViewerTegningMobil sin bro — IKKE web-rendret paneler
  // inni WebView-en (siden er en ren data-bro der, se filheaderne).
  const [dxfValgtObjektFelt, setDxfValgtObjektFelt] = useState<EgenskapsFelt[] | null>(null);
  const [dxfLaginventar, setDxfLaginventar] = useState<RegisterVerdenLagInfo[] | null>(null);
  const [dxfLagSynlighet, setDxfLagSynlighet] = useState<Record<string, boolean>>({});
  const [dxfLagpanelApent, setDxfLagpanelApent] = useState(false);

  // Nullstill F1+F2-state når brukeren velger en annen tegning, så forrige
  // tegnings objekt/lag ikke vises et øyeblikk mens den nye lastes (persistert
  // synlighet lastes på nytt i handleDxfLaginventarKlar).
  useEffect(() => {
    setDxfValgtObjektFelt(null);
    setDxfLaginventar(null);
    setDxfLagSynlighet({});
    setDxfLagpanelApent(false);
  }, [valgtTegningId]);

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

  // RETUR 2: server-spørringene kjøres KUN online. Offline (også kald start) faller
  // vi tilbake på de lokale speilene under, så navigasjonen virker uten nett i stedet
  // for å henge i evig spinner / vise falsk tomhet.
  const bygningQuery = trpc.bygning.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId && erPaaNettet },
  );

  // Hent tegninger for valgt prosjekt
  const tegningQuery = trpc.tegning.hentForProsjekt.useQuery(
    {
      projectId: valgtProsjektId!,
      ...(valgtBygningId ? { byggeplassId: valgtBygningId } : {}),
    },
    { enabled: !!valgtProsjektId && erPaaNettet },
  );

  // Hent detaljer for valgt tegning
  const valgtTegningQuery = trpc.tegning.hentMedId.useQuery(
    { id: valgtTegningId! },
    { enabled: !!valgtTegningId && erPaaNettet },
  );

  // RETUR 2 (vedtak A): lagre/nullstill brukerens rotasjons-overstyring.
  const trpcUtils = trpc.useUtils();
  const settRotasjonMutation = trpc.tegning.settRotasjon.useMutation({
    onSuccess: () => {
      if (valgtTegningId) trpcUtils.tegning.hentMedId.invalidate({ id: valgtTegningId });
    },
  });

  // Hent eksisterende oppgaver for valgt tegning
  const oppgaverQuery = trpc.oppgave.hentForTegning.useQuery(
    { drawingId: valgtTegningId! },
    { enabled: !!valgtTegningId && erPaaNettet },
  );

  // Kontrollpunkt-markører for valgt tegning (paritet med web).
  const kontrollpunktQuery = trpc.kontrollplan.hentForTegning.useQuery(
    { drawingId: valgtTegningId! },
    { enabled: !!valgtTegningId && erPaaNettet },
  );

  // Områder (soner/rom/etasjer) for valgt tegning.
  const omradeQuery = trpc.omrade.hentForTegning.useQuery(
    { tegningId: valgtTegningId! },
    { enabled: !!valgtTegningId && erPaaNettet },
  );

  // Viewer-metadata fra lokalt speil når server ikke har svart (offline/kald start).
  const detaljServer = valgtTegningQuery.data as unknown as TegningDetalj | undefined;
  const detaljSpeil = useMemo(
    () =>
      !detaljServer && valgtTegningId && brukerId
        ? hentTegningDetaljLokalt(valgtTegningId, brukerId)
        : null,
    [detaljServer, valgtTegningId, brukerId],
  );

  // Lokal tegningsliste (offline-fallback), byggeplass-scopet likt serveren
  // (valgt byggeplass ELLER prosjekt-tegning). Mappes til TegningData-formen.
  const tegningerLokalt = useMemo((): TegningData[] => {
    if (!valgtProsjektId || !brukerId) return [];
    return hentTegningerLokalt(valgtProsjektId, brukerId)
      .filter((r) => !valgtBygningId || r.byggeplassId === valgtBygningId || r.byggeplassId == null)
      .map((r) => ({
        id: r.id,
        name: r.name,
        drawingNumber: r.drawingNumber,
        discipline: r.discipline,
        floor: r.floor,
        byggeplassId: r.byggeplassId,
        fileUrl: r.fileUrl,
        mobilFileUrl: r.mobilFileUrl,
        fileType: r.fileType,
        geoReference: undefined,
        _count: { revisions: r.antallRevisjoner ?? 0 },
      }));
  }, [valgtProsjektId, brukerId, valgtBygningId, tegningQuery.data]);

  const byggeplasserLokalt = useMemo((): BygningData[] => {
    if (!valgtProsjektId || !brukerId) return [];
    return hentByggeplasserNavLokalt(valgtProsjektId, brukerId).map((b) => ({
      id: b.id,
      name: b.name,
      status: b.status ?? "",
    }));
  }, [valgtProsjektId, brukerId, bygningQuery.data]);

  // Cast data — server når online/hentet, ellers lokalt speil (RETUR 2). Memoisert så
  // identiteten er stabil (fallback-uttrykkene lager ellers nye arrays hver render →
  // nedstrøms markør-memoer ville rekjørt i evig loop).
  // `as unknown as` på tRPC-dataen (lean cast, TS2589) — den dype retur-typen tåler ikke
  // en direkte `as`. Fallback til lokalt speil når server ikke har svart (offline).
  // `as unknown as` i egne consts FØR komposisjon — den dype tRPC-retur-typen tåler verken
  // direkte `as` eller å stå i en useMemo-deps-array (TS2589). React Query gir stabil
  // data-referanse, så `?? lokal` (memoisert) er stabil nok for nedstrøms memoer.
  const bygningerServer = bygningQuery.data as unknown as BygningData[] | undefined;
  const tegningerServer = tegningQuery.data as unknown as TegningData[] | undefined;
  const bygninger = bygningerServer ?? byggeplasserLokalt;
  const tegninger = tegningerServer ?? tegningerLokalt;
  const valgtTegningDetalj: TegningDetalj | undefined =
    detaljServer ?? (detaljSpeil?.blob.detalj as TegningDetalj | undefined);
  // Markørene: server når online, ellers fra detalj-speilet (offline). `as unknown as`
  // på hver gren så unionen ikke tvinger dyp instansiering (TS2589).
  const eksisterendeOppgaver = useMemo(
    () =>
      (oppgaverQuery.data as unknown as OppgaveMarkør[] | undefined) ??
      (detaljSpeil?.blob.oppgaver as OppgaveMarkør[] | undefined) ??
      [],
    [oppgaverQuery.data, detaljSpeil],
  );
  const kontrollpunktMarkører = useMemo(
    () =>
      (kontrollpunktQuery.data as unknown as KontrollpunktMarkør[] | undefined) ??
      (detaljSpeil?.blob.kontrollpunkter as KontrollpunktMarkør[] | undefined) ??
      [],
    [kontrollpunktQuery.data, detaljSpeil],
  );
  const tegningOmrader = useMemo(
    () =>
      (omradeQuery.data as unknown as OmradeData[] | undefined) ??
      (detaljSpeil?.blob.omrader as OmradeData[] | undefined) ??
      [],
    [omradeQuery.data, detaljSpeil],
  );

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

  // RETUR 2: skriv gjennom til offline-speilene ved ONLINE-besøk, så prosjektet virker
  // fra kald start i flymodus neste gang (ikke bare mens økta er varm). Katalogen hentes
  // for HELE prosjektet (ikke byggeplass-filtrert), så alle byggeplassers tegninger er med.
  useEffect(() => {
    if (!erPaaNettet || !valgtProsjektId || !brukerId) return;
    if (tegningQuery.data) refreshTegningKatalog(trpcUtils.client, valgtProsjektId, brukerId).catch(() => {});
    if (bygningQuery.data) refreshByggeplassNavKatalog(trpcUtils.client, valgtProsjektId, brukerId).catch(() => {});
  }, [erPaaNettet, valgtProsjektId, brukerId, tegningQuery.data, bygningQuery.data, trpcUtils]);

  // Write-through av viewer-metadata (hentMedId + markører) når en tegning åpnes online —
  // fra allerede lastede data (ingen ekstra nettkall). Re-kjøres når markørene ankommer.
  useEffect(() => {
    if (!erPaaNettet || !valgtProsjektId || !brukerId || !valgtTegningId || !detaljServer) return;
    lagreTegningDetaljFraData(valgtProsjektId, brukerId, valgtTegningId, {
      detalj: detaljServer,
      oppgaver: (oppgaverQuery.data ?? []) as unknown[],
      kontrollpunkter: (kontrollpunktQuery.data ?? []) as unknown[],
      omrader: (omradeQuery.data ?? []) as unknown[],
    });
  }, [erPaaNettet, valgtProsjektId, brukerId, valgtTegningId, detaljServer, oppgaverQuery.data, kontrollpunktQuery.data, omradeQuery.data]);

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

  // Ny tegning valgt: gi dxf-viewer-grenen et friskt forsøk (RETUR leveranse 2 punkt 2).
  useEffect(() => {
    setDxfViewerFeilet(false);
  }, [valgtTegningId]);

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

  // Offline-ref for valgt tegning (fileUrl + ezdxf-mobilvariant). mobilFileUrl er den
  // faktiske vis-fila for DWG — resolver + forberedelse følger den.
  // RETUR 2: fil-URL-ene faller tilbake på LISTE-raden (tegning_local bærer dem) når
  // detalj-speilet mangler offline — da resolver viseren fortsatt file:// (forberedt) eller
  // «Ikke tilgjengelig offline», i stedet for å falle til kartet som om tegningen ikke fins.
  const detaljFileUrl = valgtTegningDetalj?.fileUrl ?? valgtTegning?.fileUrl ?? null;
  const detaljMobilFileUrl = valgtTegningDetalj?.mobilFileUrl ?? valgtTegning?.mobilFileUrl ?? null;

  // Resolver kilden viseren skal bruke: LOKAL KOPI FØRST (data-URI), ellers nett, ellers
  // «ikke tilgjengelig offline». Kjøres på tegningsbytte og når nett-status endres
  // (kommer brukeren tilbake på nett, byttes nett-URL automatisk inn).
  useEffect(() => {
    if (!detaljFileUrl) {
      setTegningKilde(null);
      setForberedt(null);
      return;
    }
    let aktiv = true;
    setKildeLaster(true);
    const ref = { fileUrl: detaljFileUrl, mobilFileUrl: detaljMobilFileUrl };
    (async () => {
      const [kilde, erForberedt] = await Promise.all([
        hentTegningKilde(ref, erPaaNettet, AUTH_CONFIG.apiUrl, valgtTegningId ?? undefined),
        erTegningForberedt(ref),
      ]);
      if (!aktiv) return;
      setTegningKilde(kilde);
      setForberedt(erForberedt);
      setKildeLaster(false);
    })();
    return () => { aktiv = false; };
  }, [detaljFileUrl, detaljMobilFileUrl, erPaaNettet, valgtTegningId]);

  // Forbered DENNE tegningen for offline (laster ned fileUrl + mobilvarianten).
  const forberedDenne = useCallback(async () => {
    if (!detaljFileUrl || forbereder) return;
    setForbereder(true);
    setOfflineMelding(t("lokasjoner.offline.forbereder"));
    try {
      await forberedTegning(
        { fileUrl: detaljFileUrl, mobilFileUrl: detaljMobilFileUrl },
        valgtTegningId ?? undefined,
        valgtBygningId,
      );
      // RETUR 2: lagre også METADATA lokalt (tegningsliste + byggeplass-liste +
      // viewer-detaljen med markører), så tegningen kan åpnes fra kald start i flymodus.
      if (valgtProsjektId && brukerId) {
        await refreshTegningKatalog(trpcUtils.client, valgtProsjektId, brukerId).catch(() => {});
        await refreshByggeplassNavKatalog(trpcUtils.client, valgtProsjektId, brukerId).catch(() => {});
        if (valgtTegningId) {
          await lagreTegningDetaljSpeil(trpcUtils.client, valgtProsjektId, brukerId, valgtTegningId).catch(() => {});
        }
      }
      const kilde = await hentTegningKilde(
        { fileUrl: detaljFileUrl, mobilFileUrl: detaljMobilFileUrl },
        erPaaNettet,
        AUTH_CONFIG.apiUrl,
        valgtTegningId ?? undefined,
      );
      setTegningKilde(kilde);
      setForberedt(true);
      setOfflineMelding(t("lokasjoner.offline.lagret"));
    } catch {
      setOfflineMelding(t("lokasjoner.offline.feilet"));
    } finally {
      setForbereder(false);
      setTimeout(() => setOfflineMelding(null), 3500);
    }
  }, [detaljFileUrl, detaljMobilFileUrl, erPaaNettet, forbereder, t, valgtTegningId, valgtBygningId, valgtProsjektId, brukerId, trpcUtils]);

  // Forbered ALLE tegningene i gjeldende byggeplass-filter for offline.
  const forberedByggeplass = useCallback(async () => {
    if (forbereder) return;
    const liste = tegninger.filter((tg) => tg.fileUrl && (tg.fileType?.toLowerCase() ?? "") !== "ifc");
    if (liste.length === 0) return;
    setForbereder(true);
    let ferdig = 0;
    for (const tg of liste) {
      setOfflineMelding(t("lokasjoner.offline.forbererAntall", { ferdig, total: liste.length }));
      try {
        await forberedTegning({ fileUrl: tg.fileUrl, mobilFileUrl: tg.mobilFileUrl ?? null }, tg.id, valgtBygningId);
        // RETUR 2: lagre viewer-metadataen (hentMedId + markører) pr. tegning.
        if (valgtProsjektId && brukerId) {
          await lagreTegningDetaljSpeil(trpcUtils.client, valgtProsjektId, brukerId, tg.id).catch(() => {});
        }
      } catch { /* enkeltfeil river ikke resten (krav 6) */ }
      ferdig++;
    }
    // RETUR 2: lagre tegningslista + byggeplass-lista for prosjektet (én gang).
    if (valgtProsjektId && brukerId) {
      await refreshTegningKatalog(trpcUtils.client, valgtProsjektId, brukerId).catch(() => {});
      await refreshByggeplassNavKatalog(trpcUtils.client, valgtProsjektId, brukerId).catch(() => {});
    }
    // Oppdater status for den åpne tegningen etterpå.
    if (detaljFileUrl) {
      setForberedt(await erTegningForberedt({ fileUrl: detaljFileUrl, mobilFileUrl: detaljMobilFileUrl }));
    }
    setOfflineMelding(t("lokasjoner.offline.byggeplassFerdig", { antall: liste.length }));
    setForbereder(false);
    setTimeout(() => setOfflineMelding(null), 3500);
  }, [tegninger, forbereder, detaljFileUrl, detaljMobilFileUrl, t, valgtBygningId, valgtProsjektId, brukerId, trpcUtils]);

  // Oppdater oppgave-/kontrollpunkt-markørene fra server.
  const oppdaterOppgaver = useCallback(() => {
    if (!valgtTegningId) return;
    trpcUtils.oppgave.hentForTegning.invalidate({ drawingId: valgtTegningId });
    trpcUtils.kontrollplan.hentForTegning.invalidate({ drawingId: valgtTegningId });
  }, [valgtTegningId, trpcUtils]);

  // Tegningsinformasjon — kort faktasammendrag (ingen redigering).
  const visTegningsinfo = useCallback(() => {
    if (!valgtTegning) return;
    const rader = [
      valgtTegning.drawingNumber ? `${t("tegninger.tegningsnummer")}: ${valgtTegning.drawingNumber}` : null,
      valgtTegning.discipline ? `${t("tegninger.feltFagdisiplin")}: ${valgtTegning.discipline}` : null,
      valgtTegning.floor ? `${t("tegninger.etasje")}: ${valgtTegning.floor}` : null,
      `${t("lokasjoner.info.revisjoner")}: ${valgtTegning._count.revisions}`,
      `${t("lokasjoner.offline.statusEtikett")}: ${forberedt ? t("lokasjoner.offline.lagret") : t("lokasjoner.offline.ikkeLagret")}`,
    ].filter(Boolean);
    Alert.alert(valgtTegning.name, rader.join("\n"));
  }, [valgtTegning, forberedt, t]);

  // Treprikk-meny (iOS ActionSheet / Android Alert — paritet, ingen død knapp).
  const visTreprikkmeny = useCallback(() => {
    const flereTegninger = tegninger.filter((tg) => tg.fileUrl).length > 1;
    const offlineEtikett = forberedt ? t("lokasjoner.offline.lagret") : t("lokasjoner.forberedOffline");
    // Rekkefølge: info · forbered denne · (forbered byggeplass) · oppdater oppgaver.
    const handlinger: Array<{ etikett: string; kjor: () => void }> = [
      { etikett: t("lokasjoner.tegningsinformasjon"), kjor: visTegningsinfo },
      { etikett: offlineEtikett, kjor: () => { void forberedDenne(); } },
      ...(flereTegninger ? [{ etikett: t("lokasjoner.offline.forberedByggeplass"), kjor: () => { void forberedByggeplass(); } }] : []),
      { etikett: t("lokasjoner.oppdatereOppgaver"), kjor: oppdaterOppgaver },
    ];
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [t("handling.avbryt"), ...handlinger.map((h) => h.etikett)], cancelButtonIndex: 0 },
        (indeks) => { if (indeks > 0) handlinger[indeks - 1]?.kjor(); },
      );
    } else {
      Alert.alert(
        valgtTegning?.name ?? t("lokasjoner.tittel"),
        undefined,
        [
          ...handlinger.map((h) => ({ text: h.etikett, onPress: h.kjor })),
          { text: t("handling.avbryt"), style: "cancel" as const },
        ],
      );
    }
  }, [tegninger, forberedt, valgtTegning, t, visTegningsinfo, forberedDenne, forberedByggeplass, oppdaterOppgaver]);

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

  // Opprett her (ordre § 2): plasseringsmodus beholder dagens verifiser-flyt
  // (sett markør → Bekreft-banner). Langt trykk i navigering setter markøren OG
  // åpner malvalget direkte, slik ordren krever.
  const håndterOpprett = useCallback(
    (posX: number, posY: number) => {
      setMarkørPosisjon({ x: posX, y: posY });
      if (!plasseringsmodus) setVisMalVelger(true);
    },
    [plasseringsmodus],
  );

  // Hint ved kort trykk i navigering (ordre § 1): hint-boblen tegnes i WebView;
  // her blinker vi bryteren én gang slik at brukeren ser hvor modus byttes.
  const [bryterBlink, setBryterBlink] = useState(false);
  const blinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const håndterHint = useCallback(() => {
    setBryterBlink(true);
    if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current);
    blinkTimerRef.current = setTimeout(() => setBryterBlink(false), 220);
  }, []);
  useEffect(() => () => { if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current); }, []);

  // Måleverktøy har forrang (RETUR 1 § 3/4): slå av plasseringsmodus så banneret
  // forsvinner og trykk ikke tolkes som plassering mens måling er aktiv.
  const håndterMaleModus = useCallback((aktiv: boolean) => {
    if (aktiv) { setPlasseringsmodus(false); setMarkørPosisjon(null); }
  }, []);

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

  // Offline uten detalj-speil har vi fortsatt liste-radens fileUrl → vis viseren
  // (file:// eller «Ikke tilgjengelig offline»), ikke kartet (RETUR 2).
  const visserTegning = !!valgtTegningId && !!detaljFileUrl;
  // Mobil leveranse 2 (arbeidstegning-f1): last+vis via dxf-viewer, UTEN
  // markør-trykk/måling/GPS-plassering ennå (skjerm→verden-projeksjonen for
  // det er egen leveranse) — samme reduksjon som webs `!brukDxfViewer`-grener.
  // Samme bryter som leveranse 1 (erTestLoginAktiv), ingen ny EAS-variabel.
  // RETUR leveranse 2 (Kontrollør, punkt 2): offline (eller en WebView-last-feil/
  // -tidsgrense, se dxfViewerFeilet) skal ALDRI ta denne grenen — den krever nett
  // for selve WebView-siden (`/dxf-viewer-smoketest`), og dxf-filene er ikke
  // offline-cachet (F7, ute av scope). Faller til SVG/raster-veien under, som
  // allerede håndterer offline ærlig (file:// lokal kopi eller «Ikke tilgjengelig
  // offline», kommentaren over `visserTegning`).
  const brukDxfViewerMobil =
    erTestLoginAktiv &&
    erPaaNettet &&
    !dxfViewerFeilet &&
    !!valgtTegningDetalj?.dxfViewerFileUrl &&
    !!valgtTegningDetalj?.registerWorldUrl;

  const håndterDxfViewerLastFeil = useCallback(() => {
    setDxfViewerFeilet(true);
    setOfflineMelding(t("lokasjoner.dxfViewerFeilet"));
    setTimeout(() => setOfflineMelding(null), 3500);
  }, [t]);

  // F2 (spec § 3, Q4): lagpanel-handlere. Husker synlighet pr. tegning pr. bruker
  // PÅ ENHETEN (expo-secure-store, nøkkel pr. drawingId — se lagSynlighetLagring.ts
  // for hvorfor ikke AsyncStorage). Samme struktur som web sin page.tsx, så de to
  // flatene er lette å sammenligne.
  const handleDxfLaginventarKlar = useCallback(
    (laginventar: RegisterVerdenLagInfo[] | null) => {
      setDxfLaginventar(laginventar);
      const drawingId = valgtTegningDetalj?.id;
      if (!laginventar || !drawingId) {
        setDxfLagSynlighet({});
        return;
      }
      void hentSkjulteLag(drawingId).then((skjulteLag) => {
        setDxfLagSynlighet(byggSynlighetFraSkjulte(skjulteLag));
        for (const navn of skjulteLag) dxfViewerRef.current?.settLagSynlig(navn, false);
      });
    },
    [valgtTegningDetalj?.id],
  );

  const lagreDxfLagSynlighet = useCallback(
    (neste: Record<string, boolean>) => {
      setDxfLagSynlighet(neste);
      const drawingId = valgtTegningDetalj?.id;
      if (!drawingId) return;
      void lagreSkjulteLag(drawingId, utledSkjulteLag(neste));
    },
    [valgtTegningDetalj?.id],
  );

  const handleDxfSettLag = useCallback(
    (navn: string, synlig: boolean) => {
      dxfViewerRef.current?.settLagSynlig(navn, synlig);
      lagreDxfLagSynlighet({ ...dxfLagSynlighet, [navn]: synlig });
    },
    [dxfLagSynlighet, lagreDxfLagSynlighet],
  );

  const handleDxfSettGruppe = useCallback(
    (lagNavnListe: string[], synlig: boolean) => {
      const neste = { ...dxfLagSynlighet };
      for (const navn of lagNavnListe) {
        dxfViewerRef.current?.settLagSynlig(navn, synlig);
        neste[navn] = synlig;
      }
      lagreDxfLagSynlighet(neste);
    },
    [dxfLagSynlighet, lagreDxfLagSynlighet],
  );

  const handleDxfBareDette = useCallback(
    (navn: string) => {
      if (!dxfLaginventar) return;
      const neste: Record<string, boolean> = {};
      for (const li of dxfLaginventar) {
        const synlig = li.navn === navn;
        neste[li.navn] = synlig;
        dxfViewerRef.current?.settLagSynlig(li.navn, synlig);
      }
      lagreDxfLagSynlighet(neste);
    },
    [dxfLaginventar, lagreDxfLagSynlighet],
  );

  const handleDxfAllePaa = useCallback(() => {
    if (!dxfLaginventar) return;
    for (const li of dxfLaginventar) dxfViewerRef.current?.settLagSynlig(li.navn, true);
    lagreDxfLagSynlighet({});
  }, [dxfLaginventar, lagreDxfLagSynlighet]);

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
          {visserTegning && !brukDxfViewerMobil && (
            <Pressable
              onPress={() => {
                setPlasseringsmodus(!plasseringsmodus);
                if (plasseringsmodus) setMarkørPosisjon(null);
              }}
              hitSlop={8}
              className={`rounded-full px-3 py-1 ${plasseringsmodus ? "bg-white" : bryterBlink ? "bg-white/70" : "bg-white/20"}`}
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
          {/* Offline-status (kun når tegning vises): lagret ✓ · last ned · uten nett.
              Tapp for å forberede når på nett og ikke lagret. */}
          {visserTegning && !brukDxfViewerMobil && (
            <Pressable
              onPress={() => { if (!forberedt && erPaaNettet) void forberedDenne(); }}
              hitSlop={8}
              disabled={forbereder || forberedt === true || (!erPaaNettet && !forberedt)}
              accessibilityLabel={t("lokasjoner.offline.statusEtikett")}
            >
              {forbereder ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : forberedt ? (
                <CloudCheck size={20} color="#4ade80" />
              ) : erPaaNettet ? (
                <CloudDownload size={20} color="#ffffff" />
              ) : (
                <CloudOff size={20} color="#93c5fd" />
              )}
            </Pressable>
          )}
          <Pressable onPress={visTreprikkmeny} hitSlop={12}>
            <MoreVertical size={20} color="#ffffff" />
          </Pressable>
        </View>
      </View>

      {/* Offline-forberedelse: liten status/fremdrift-stripe (forbereder/lagret/feilet). */}
      {visserTegning && !brukDxfViewerMobil && offlineMelding && (
        <View className="flex-row items-center gap-2 bg-blue-50 px-4 py-2">
          {forbereder && <ActivityIndicator size="small" color="#1e40af" />}
          <Text className="flex-1 text-xs text-blue-700">{offlineMelding}</Text>
        </View>
      )}

      {/* GPS-status-banner (kun for georefererte tegninger med problemer) */}
      {visserTegning && !brukDxfViewerMobil && harGeoRef && gpsStatus === "ingen_tillatelse" && (
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
      {visserTegning && !brukDxfViewerMobil && harGeoRef && gpsStatus === "ugyldig_georef" && (
        <View className="flex-row items-center gap-2 bg-amber-50 px-4 py-2">
          <Text className="flex-1 text-xs text-amber-700">
            {t("lokasjoner.ugyldigGeoref")}
          </Text>
        </View>
      )}
      {visserTegning && !brukDxfViewerMobil && harGeoRef && gpsStatus === "feil" && (
        <View className="flex-row items-center gap-2 bg-amber-50 px-4 py-2">
          <Text className="flex-1 text-xs text-amber-700">
            {t("lokasjoner.gpsUtilgjengelig")}
          </Text>
        </View>
      )}
      {visserTegning && !brukDxfViewerMobil && harGeoRef && gpsStatus === "venter" && (
        <View className="flex-row items-center gap-2 bg-blue-50 px-4 py-2">
          <ActivityIndicator size="small" color="#1e40af" />
          <Text className="text-xs text-blue-700">{t("lokasjoner.henterGps")}</Text>
        </View>
      )}
      {visserTegning && !brukDxfViewerMobil && harGeoRef && gpsDebug && gpsStatus === "aktiv" && (
        <View className="bg-gray-100 px-4 py-1">
          <Text className="text-[10px] text-gray-500">{gpsDebug}</Text>
        </View>
      )}

      {/* Plasseringsmodus-banner */}
      {visserTegning && !brukDxfViewerMobil && plasseringsmodus && (
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
      {visserTegning && !brukDxfViewerMobil && (
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
          brukDxfViewerMobil ? (
            <View className="flex-1">
              <DxfViewerTegningMobil
                ref={dxfViewerRef}
                key={valgtTegningDetalj?.id}
                dxfUrl={`/api${valgtTegningDetalj?.dxfViewerFileUrl}`}
                registerWorldUrl={`/api${valgtTegningDetalj?.registerWorldUrl}`}
                rotasjonOverstyrt={valgtTegningDetalj?.rotasjonOverstyrt ?? null}
                onLastFeil={håndterDxfViewerLastFeil}
                onMaleKlarEndring={setDxfKanMale}
                onObjektValgt={setDxfValgtObjektFelt}
                onLaginventarKlar={handleDxfLaginventarKlar}
              />
              <DxfMaleVerktoylinje
                kanMale={dxfKanMale}
                onVerktoy={(v) => dxfViewerRef.current?.settMaleVerktoy(v)}
                onOrtho={(på) => dxfViewerRef.current?.settMaleOrtho(på)}
                onSnap={(på) => dxfViewerRef.current?.settMaleSnap(på)}
                onFullfoer={() => dxfViewerRef.current?.fullfoerMaling()}
                onGjenoppta={() => dxfViewerRef.current?.gjenopptaMaling()}
                onSlettAktiv={() => dxfViewerRef.current?.slettAktivMaling()}
                onSlettAlle={() => dxfViewerRef.current?.slettAlleMaalinger()}
              />
              {/* F2: flytende lagpanel-knapp — motstykke til web sin "Lag (N)"-knapp,
                  plassert til høyre så den ikke kolliderer med måle-toolbaren (venstre). */}
              {dxfLaginventar && (
                <Pressable
                  onPress={() => setDxfLagpanelApent((a) => !a)}
                  className="absolute right-2 top-2 flex-row items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5"
                  testID="dxf-lagpanel-knapp"
                >
                  <Layers size={14} color="#1e3a8a" />
                  <Text className="text-xs font-medium text-blue-900">
                    {t("tegningsvelger.lag.tittel")} ({dxfLaginventar.length})
                  </Text>
                </Pressable>
              )}
              <TegningEgenskapsArk felt={dxfValgtObjektFelt} onLukk={() => setDxfValgtObjektFelt(null)} />
              <TegningLagPanel
                synlig={dxfLagpanelApent}
                laginventar={dxfLaginventar ?? []}
                synlighet={dxfLagSynlighet}
                onSettLag={handleDxfSettLag}
                onSettGruppe={handleDxfSettGruppe}
                onBareDette={handleDxfBareDette}
                onAllePaa={handleDxfAllePaa}
                onLukk={() => setDxfLagpanelApent(false)}
              />
            </View>
          ) : kildeLaster || !tegningKilde ? (
            // Mens lokal-kopi-resolveren jobber (les cache / bygg data-URI).
            <View className="flex-1 items-center justify-center bg-black">
              <ActivityIndicator size="large" color="#ffffff" />
            </View>
          ) : (
          <TegningsVisning
            // Lokal kopi FØRST (data-URI) → nett → utilgjengelig. Resolvert i effekten over.
            tegningUrl={tegningKilde.uri ?? ""}
            offlineUtilgjengelig={tegningKilde.offlineUtilgjengelig}
            tegningNavn={valgtTegningDetalj?.name ?? valgtTegning?.name ?? ""}
            onLukk={håndterLukkTegning}
            onMarkørTrykk={håndterMarkørTrykk}
            markører={markører}
            omrader={omrader}
            gpsMarkør={gpsMarkør}
            pdfPageSize={valgtTegningDetalj?.pdfPageSize ?? undefined}
            plasseringAktiv={plasseringsmodus}
            onHint={håndterHint}
            onOpprett={håndterOpprett}
            maleData={{
              mmPrPiksel: valgtTegningDetalj?.mmPrPiksel ?? null,
              scale: valgtTegningDetalj?.scale ?? null,
              scaleKilde: valgtTegningDetalj?.scaleKilde ?? null,
              imageWidth: valgtTegningDetalj?.imageWidth ?? null,
              imageHeight: valgtTegningDetalj?.imageHeight ?? null,
            }}
            onMaleModusEndring={håndterMaleModus}
            rotasjon={
              (valgtTegningDetalj?.fileType ?? "") === "svg"
                ? { auto: valgtTegningDetalj?.autoRotasjon ?? null, overstyrt: valgtTegningDetalj?.rotasjonOverstyrt ?? null }
                : null
            }
            startutsnitt={(() => {
              // L4b: mobilen åpner på startutsnittet (bygget) i stedet for fit-to-width på
              // rutenettet. Kun SVG; Json-feltet leses gjennom en smal struktur.
              if ((valgtTegningDetalj?.fileType ?? "") !== "svg") return null;
              const su = valgtTegningDetalj?.startutsnitt as
                | { x?: unknown; y?: unknown; w?: unknown; h?: unknown }
                | null
                | undefined;
              if (!su || typeof su.x !== "number" || typeof su.y !== "number" || typeof su.w !== "number" || typeof su.h !== "number") return null;
              return { x: su.x, y: su.y, w: su.w, h: su.h };
            })()}
            // C2 (L6): ezdxf-mobilvarianten (farge-gruppert, ~2,5 MB) rendres INLINE så
            // streken kan dempes ved zoom. Kun når mobilFileUrl finnes — den er alltid lett
            // nok til å inlines. RETUR 2: en gammel ezdxf UTEN mobilvariant har bare den
            // fulle ~22 MB-fila; å inlinee den henger WebView-en (målt i WebKit), så den
            // «behandles som egen» = `<img>` (streken dempes ikke; løses ved re-konvertering
            // som lager den lette mobilvarianten). byggHtml C1-gater selve inline-veien.
            svgInline={
              (valgtTegningDetalj?.fileType ?? "") === "svg" && !!valgtTegningDetalj?.mobilFileUrl
            }
            onSettRotasjon={(grader) => {
              if (valgtTegningId) settRotasjonMutation.mutate({ drawingId: valgtTegningId, grader });
            }}
          />
          )
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
