import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
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
  Plus,
  Crosshair,
  Navigation,
  Eye,
  EyeOff,
  Check,
  X,
} from "lucide-react-native";
import * as Location from "expo-location";
import { trpc } from "../../src/lib/trpc";
import { useProsjekt } from "../../src/kontekst/ProsjektKontekst";
import { useBygning } from "../../src/kontekst/BygningKontekst";
import { AUTH_CONFIG } from "../../src/config/auth";
import { KartVisning } from "../../src/components/KartVisning";
import { TegningsVisning } from "../../src/components/TegningsVisning";
import type { Markør, GpsMarkør } from "../../src/components/TegningsVisning";
import { TegningsVelger } from "../../src/components/TegningsVelger";
import { OppgaveModal } from "../../src/components/OppgaveModal";
import { MalVelger } from "../../src/components/MalVelger";
import { useRouter } from "expo-router";
import {
  beregnTransformasjon,
  gpsTilTegning,
} from "@sitedoc/shared/utils";
import type { GeoReferanse } from "@sitedoc/shared";

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
  buildingId: string | null;
  fileUrl: string | null;
  geoReference?: unknown;
  _count: { revisions: number };
}

interface TegningDetalj {
  id: string;
  name: string;
  fileUrl: string | null;
  geoReference?: unknown;
}

interface OppgaveMarkør {
  id: string;
  number: number;
  positionX: number;
  positionY: number;
  status: string;
  template: { prefix: string | null } | null;
}

export default function LokasjonerSkjerm() {
  const { valgtProsjektId } = useProsjekt();
  const { valgtBygningId, settBygning } = useBygning();
  const [valgtTegningId, setValgtTegningId] = useState<string | null>(null);

  const router = useRouter();

  // Modus: visning (standard) eller plassering (opprett oppgave)
  const [plasseringsmodus, setPlasseringsmodus] = useState(false);

  // Markør- og oppgavemodal-state
  const [markørPosisjon, setMarkørPosisjon] = useState<{ x: number; y: number } | null>(null);
  const [visOppgaveModal, setVisOppgaveModal] = useState(false);
  const [visMalVelger, setVisMalVelger] = useState(false);
  const [valgtMalId, setValgtMalId] = useState<string | null>(null);
  const [visEksisterende, setVisEksisterende] = useState(true);

  // Hent alle bygninger for valgt prosjekt
  const bygningQuery = trpc.bygning.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId },
  );

  // Hent tegninger for valgt prosjekt
  const tegningQuery = trpc.tegning.hentForProsjekt.useQuery(
    {
      projectId: valgtProsjektId!,
      ...(valgtBygningId ? { buildingId: valgtBygningId } : {}),
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

  // Cast data
  const bygninger = (bygningQuery.data ?? []) as BygningData[];
  const tegninger = (tegningQuery.data ?? []) as TegningData[];
  const valgtTegningDetalj = valgtTegningQuery.data as TegningDetalj | undefined;
  const eksisterendeOppgaver = (oppgaverQuery.data ?? []) as OppgaveMarkør[];

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

  // Bygg markørliste: eksisterende oppgaver (røde, valgfritt) + ny markør (grønn)
  const markører: Markør[] = useMemo(() => {
    const liste: Markør[] = visEksisterende
      ? eksisterendeOppgaver
          .filter((o) => o.positionX != null && o.positionY != null)
          .map((o) => ({
            id: o.id,
            x: o.positionX,
            y: o.positionY,
            label: `${o.template?.prefix ?? ""}${o.template?.prefix ? "-" : ""}${String(o.number).padStart(3, "0")}`,
          }))
      : [];

    if (markørPosisjon) {
      liste.push({
        id: "ny-oppgave",
        x: markørPosisjon.x,
        y: markørPosisjon.y,
        farge: "#10b981",
      });
    }

    return liste;
  }, [eksisterendeOppgaver, markørPosisjon, visEksisterende]);

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

  // Treprikk-meny
  const visTreprikkmeny = useCallback(() => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [
            "Avbryt",
            "Tegningsinformasjon",
            "Forbered til offline",
            "Oppdatere oppgaver",
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
  const håndterVelgTegning = useCallback((id: string) => {
    setValgtTegningId(id);
    setMarkørPosisjon(null);
    setPlasseringsmodus(false);
  }, []);

  // Håndter lukking av tegning
  const håndterLukkTegning = useCallback(() => {
    setValgtTegningId(null);
    setMarkørPosisjon(null);
    setPlasseringsmodus(false);
  }, []);

  // Håndter avbryt i bottom sheet
  const håndterAvbryt = useCallback(() => {
    setValgtTegningId(null);
    settBygning(null);
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
      Alert.alert("GPS ikke tilgjengelig", "Venter på GPS-posisjon. Prøv igjen om et øyeblikk.");
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

  // Håndter trykk på eksisterende markør
  const håndterMarkørTrykk = useCallback((markørId: string) => {
    if (markørId === "ny-oppgave") return;
    router.push(`/oppgave/${markørId}`);
  }, [router]);

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
            Lokasjoner
          </Text>
          <Text className="mt-2 text-center text-sm text-gray-400">
            Velg et prosjekt for å se lokasjoner
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
        <View>
          <Text className="text-sm font-semibold text-white">Lokasjoner</Text>
          {valgtBygningId && bygninger.length > 0 && (
            <Text className="text-[10px] text-blue-200" numberOfLines={1}>
              {bygninger.find((b) => b.id === valgtBygningId)?.name ?? ""}
            </Text>
          )}
        </View>
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
                  {plasseringsmodus ? "Plassering" : "Navigering"}
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
              GPS-tillatelse mangler
            </Text>
            <Text className="text-xs text-red-600">
              Trykk her for å åpne Innstillinger og aktivere stedstjenester
            </Text>
          </View>
          <MapPin size={16} color="#dc2626" />
        </Pressable>
      )}
      {visserTegning && harGeoRef && gpsStatus === "ugyldig_georef" && (
        <View className="flex-row items-center gap-2 bg-amber-50 px-4 py-2">
          <Text className="flex-1 text-xs text-amber-700">
            Georeferansen har identiske referansepunkter. Sett to ulike punkter på tegningen.
          </Text>
        </View>
      )}
      {visserTegning && harGeoRef && gpsStatus === "feil" && (
        <View className="flex-row items-center gap-2 bg-amber-50 px-4 py-2">
          <Text className="flex-1 text-xs text-amber-700">
            GPS-posisjon utilgjengelig. Prøv å gå utendørs eller vent litt.
          </Text>
        </View>
      )}
      {visserTegning && harGeoRef && gpsStatus === "venter" && (
        <View className="flex-row items-center gap-2 bg-blue-50 px-4 py-2">
          <ActivityIndicator size="small" color="#1e40af" />
          <Text className="text-xs text-blue-700">Henter GPS-posisjon…</Text>
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
                  Verifiser posisjon
                </Text>
                <View className="flex-row items-center gap-2">
                  <Pressable
                    onPress={avbrytMarkør}
                    className="flex-row items-center gap-1 rounded-full bg-gray-200 px-2.5 py-1"
                  >
                    <X size={12} color="#6b7280" />
                    <Text className="text-xs font-medium text-gray-600">Flytt</Text>
                  </Pressable>
                  <Pressable
                    onPress={bekreftPosisjon}
                    className="flex-row items-center gap-1 rounded-full bg-green-600 px-3 py-1"
                  >
                    <Check size={12} color="#ffffff" />
                    <Text className="text-xs font-medium text-white">Bekreft</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text className="text-xs text-amber-700">
                  Trykk på tegningen for å plassere markør
                </Text>
                {harGeoRef && gpsMarkør && (
                  <Pressable
                    onPress={brukGpsPosisjon}
                    className="flex-row items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1"
                  >
                    <Crosshair size={12} color="#1e40af" />
                    <Text className="text-xs font-medium text-blue-700">Bruk GPS</Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
          {/* Toggle for eksisterende oppgaver */}
          <Pressable
            onPress={() => setVisEksisterende(!visEksisterende)}
            className="mt-1.5 flex-row items-center gap-1.5"
          >
            {visEksisterende ? (
              <Eye size={12} color="#6b7280" />
            ) : (
              <EyeOff size={12} color="#6b7280" />
            )}
            <Text className="text-xs text-gray-500">
              {visEksisterende ? "Skjul tidligere oppgaver" : "Vis tidligere oppgaver"}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Bygningsvelger — horisontalt chip-bånd (Dalux-mønster) */}
      {!visserTegning && bygninger.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 6 }}
          className="border-b border-gray-200 bg-white"
        >
          <Pressable
            onPress={() => settBygning(null)}
            className={`rounded-full px-3 py-1.5 ${!valgtBygningId ? "bg-sitedoc-blue" : "bg-gray-100"}`}
          >
            <Text className={`text-xs font-medium ${!valgtBygningId ? "text-white" : "text-gray-600"}`}>
              Alle
            </Text>
          </Pressable>
          {bygninger.map((b) => (
            <Pressable
              key={b.id}
              onPress={() => settBygning(b.id)}
              className={`rounded-full px-3 py-1.5 ${valgtBygningId === b.id ? "bg-sitedoc-blue" : "bg-gray-100"}`}
            >
              <Text
                className={`text-xs font-medium ${valgtBygningId === b.id ? "text-white" : "text-gray-600"}`}
                numberOfLines={1}
              >
                {b.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Hovedinnhold */}
      <View className="flex-1">
        {lasterData ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#1e40af" />
            <Text className="mt-3 text-sm text-gray-500">
              Henter lokasjonsdata…
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
            gpsMarkør={gpsMarkør}
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
        onVelgBygning={settBygning}
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
