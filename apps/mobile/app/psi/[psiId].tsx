import { useState, useMemo, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from "react-native";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { ArrowLeft, ChevronRight, Check, Globe } from "lucide-react-native";
import { trpc } from "../../src/lib/trpc";
import { useAuth } from "../../src/providers/AuthProvider";
import { RapportObjektRenderer, DISPLAY_TYPER } from "../../src/components/rapportobjekter/RapportObjektRenderer";
import { SignaturObjekt } from "../../src/components/rapportobjekter/SignaturObjekt";
import { useOversettelse } from "../../src/hooks/useOversettelse";

interface SeksjonData {
  tittel: string;
  objekter: Array<{ id: string; type: string; label: string; required: boolean; config: Record<string, unknown> }>;
  harQuiz: boolean;
  harVideo: boolean;
  harSignatur: boolean;
}

export default function PsiLeser() {
  const { psiId } = useLocalSearchParams<{ psiId: string }>();
  const { bruker } = useAuth();
  const brukerSpraak = bruker?.language ?? "nb";

  const [aktivSeksjon, setAktivSeksjon] = useState(0);
  const [seksjonFullfort, setSeksjonFullfort] = useState<Set<number>>(new Set());
  const [feltVerdier, setFeltVerdier] = useState<Record<string, unknown>>({});
  const [signaturData, setSignaturData] = useState<string | null>(null);
  const [hmsKortNr, setHmsKortNr] = useState("");
  const scrollRef = useRef<ScrollView>(null);
  const [harScrolletTilBunn, setHarScrolletTilBunn] = useState(false);

  // Hent PSI med malobjekter
  const { data: psi, isLoading: psiLaster } = trpc.psi.hentMedObjekter.useQuery(
    { psiId: psiId ?? "" },
    { enabled: !!psiId },
  );

  // Start gjennomføring
  const startMut = trpc.psi.startGjennomforing.useMutation();
  const oppdaterMut = trpc.psi.oppdaterProgresjon.useMutation();
  const fullforMut = trpc.psi.fullfør.useMutation({
    onSuccess: () => {
      Alert.alert("PSI fullført", "Du har gjennomført og signert sikkerhetsinstruksen.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    },
  });

  // Oversettelse av PSI-innhold (Lag 2)
  const prosjektId = (psi as unknown as { projectId?: string })?.projectId;
  const psiKildesprak = (psi as unknown as { template?: { project?: { sourceLanguage?: string } } })?.template?.project?.sourceLanguage;
  const psiObjekter = (psi?.template as unknown as { objects?: Array<{ id: string; label: string; config: Record<string, unknown> }> })?.objects ?? [];
  const {
    oversettelser: _oversettelser,
    laster: oversettelseLaster,
    visOversettKnapp,
    oversettAlt,
  } = useOversettelse(prosjektId, psiKildesprak, psiObjekter);

  // Start gjennomføring ved første lasting
  const [signaturId, setSignaturId] = useState<string | null>(null);
  const harStartet = useRef(false);

  const startPsi = useCallback(async () => {
    if (harStartet.current || !psiId) return;
    harStartet.current = true;
    try {
      const resultat = await startMut.mutateAsync({
        psiId,
        language: brukerSpraak,
      });
      setSignaturId(resultat.signaturId);
      if (resultat.progresjon > 0) {
        setAktivSeksjon(resultat.progresjon);
        const fullførte = new Set<number>();
        for (let i = 0; i < resultat.progresjon; i++) fullførte.add(i);
        setSeksjonFullfort(fullførte);
      }
    } catch (_err) {
      // Ignorer
    }
  }, [psiId, brukerSpraak, startMut]);

  // Start automatisk når PSI er lastet
  if (psi && !signaturId && !startMut.isPending) {
    startPsi();
  }

  // Del objekter inn i seksjoner basert på headings
  const seksjoner = useMemo((): SeksjonData[] => {
    if (!psi?.template?.objects) return [];
    const objekter = (psi.template as unknown as { objects: Array<{
      id: string; type: string; label: string; required: boolean;
      config: Record<string, unknown>; sortOrder: number; parentId: string | null;
    }> }).objects;

    const rotObjekter = objekter.filter((o) => !o.parentId);
    const result: SeksjonData[] = [];
    let gjeldende: SeksjonData | null = null;

    for (const obj of rotObjekter) {
      if (obj.type === "heading") {
        if (gjeldende) result.push(gjeldende);
        gjeldende = { tittel: obj.label, objekter: [], harQuiz: false, harVideo: false, harSignatur: false };
      } else {
        if (!gjeldende) {
          gjeldende = { tittel: "Introduksjon", objekter: [], harQuiz: false, harVideo: false, harSignatur: false };
        }
        gjeldende.objekter.push(obj);
        if (obj.type === "quiz") gjeldende.harQuiz = true;
        if (obj.type === "video") gjeldende.harVideo = true;
        if (obj.type === "signature") gjeldende.harSignatur = true;
      }
    }
    if (gjeldende) result.push(gjeldende);
    return result;
  }, [psi]);

  const gjeldendeSeksjon = seksjoner[aktivSeksjon];
  const erSignaturSeksjon = gjeldendeSeksjon?.harSignatur ?? false;
  const [innholdKortNok, setInnholdKortNok] = useState(false);

  const kanGåVidere = useMemo(() => {
    if (!gjeldendeSeksjon) return false;
    if (gjeldendeSeksjon.harQuiz) {
      return gjeldendeSeksjon.objekter.filter((o) => o.type === "quiz").every((o) => feltVerdier[o.id] !== undefined);
    }
    if (gjeldendeSeksjon.harVideo) {
      return gjeldendeSeksjon.objekter.filter((o) => o.type === "video").every((o) => feltVerdier[o.id] === "watched");
    }
    if (erSignaturSeksjon) return !!signaturData;
    return harScrolletTilBunn || innholdKortNok;
  }, [gjeldendeSeksjon, feltVerdier, harScrolletTilBunn, innholdKortNok, signaturData, erSignaturSeksjon]);

  const gåTilNeste = useCallback(async () => {
    if (!signaturId) return;
    const nyeFullførte = new Set(seksjonFullfort);
    nyeFullførte.add(aktivSeksjon);
    setSeksjonFullfort(nyeFullførte);

    if (erSignaturSeksjon && signaturData) {
      await fullforMut.mutateAsync({
        signaturId,
        signatureData: signaturData,
        hmsKortNr: /^\d{7}$/.test(hmsKortNr) ? hmsKortNr : undefined,
        data: feltVerdier as Record<string, unknown>,
      });
      return;
    }

    const nySeksjon = aktivSeksjon + 1;
    oppdaterMut.mutate({ signaturId, progress: nySeksjon, data: feltVerdier as Record<string, unknown> });
    setAktivSeksjon(nySeksjon);
    setHarScrolletTilBunn(false);
    setInnholdKortNok(false);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [signaturId, aktivSeksjon, seksjonFullfort, erSignaturSeksjon, signaturData, feltVerdier, fullforMut, oppdaterMut]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    // Innhold passer uten scroll → tillat videre direkte
    if (contentSize.height <= layoutMeasurement.height + 50) {
      if (!innholdKortNok) setInnholdKortNok(true);
      return;
    }
    const erNærBunn = layoutMeasurement.height + contentOffset.y >= contentSize.height - 50;
    if (erNærBunn && !harScrolletTilBunn) setHarScrolletTilBunn(true);
  }, [harScrolletTilBunn, innholdKortNok]);

  const settFeltVerdi = useCallback((objektId: string, verdi: unknown) => {
    setFeltVerdier((prev) => ({ ...prev, [objektId]: verdi }));
  }, []);

  if (psiLaster || !psi) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#1e40af" />
          <Text className="mt-3 text-sm text-gray-500">Laster sikkerhetsinstruks...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (seksjoner.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <Header onTilbake={() => router.back()} tittel="PSI" />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-sm text-gray-500">Ingen innhold i PSI</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Header
        onTilbake={() => {
          if (aktivSeksjon > 0) {
            setAktivSeksjon(aktivSeksjon - 1);
            setHarScrolletTilBunn(false);
            setInnholdKortNok(false);
            scrollRef.current?.scrollTo({ y: 0, animated: true });
          } else {
            router.back();
          }
        }}
        tittel={(psi.template as unknown as { name: string }).name}
        ekstra={visOversettKnapp ? (
          <TouchableOpacity
            onPress={oversettAlt}
            className="rounded-lg border border-gray-200 p-1.5"
            disabled={oversettelseLaster}
          >
            {oversettelseLaster
              ? <ActivityIndicator size="small" color="#1e40af" />
              : <Globe size={18} color="#1e40af" />
            }
          </TouchableOpacity>
        ) : undefined}
      />

      {/* Progresjonslinje */}
      <View className="flex-row border-b border-gray-100 px-4 py-2">
        {seksjoner.map((_, i) => (
          <View
            key={i}
            className={`mx-0.5 h-1.5 flex-1 rounded-full ${
              seksjonFullfort.has(i) ? "bg-green-500" : i === aktivSeksjon ? "bg-sitedoc-primary" : "bg-gray-200"
            }`}
          />
        ))}
      </View>

      {/* Seksjonstittel */}
      <View className="border-b border-gray-100 px-4 py-3">
        <Text className="text-xs text-gray-400">{aktivSeksjon + 1} / {seksjoner.length}</Text>
        <Text className="mt-0.5 text-base font-semibold text-gray-900">{gjeldendeSeksjon?.tittel}</Text>
      </View>

      {/* Innhold */}
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        onScroll={onScroll}
        scrollEventThrottle={200}
      >
        {gjeldendeSeksjon?.objekter.map((objekt) => {
          if (objekt.type === "signature") {
            return (
              <View key={objekt.id} className="mt-4">
                {/* HMS-kortnummer */}
                <Text className="mb-1 text-sm font-medium text-gray-700">HMS-kortnummer</Text>
                <TextInput
                  value={hmsKortNr}
                  onChangeText={(t) => setHmsKortNr(t.replace(/\D/g, "").slice(0, 7))}
                  keyboardType="number-pad"
                  maxLength={7}
                  placeholder="7 siffer"
                  className="mb-4 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm"
                />
                <Text className="mb-2 text-sm font-medium text-gray-700">Signatur</Text>
                <SignaturObjekt
                  objekt={objekt}
                  verdi={signaturData ?? ""}
                  onEndreVerdi={(v) => setSignaturData(v as string)}
                  leseModus={false}
                />
              </View>
            );
          }
          return (
            <RapportObjektRenderer
              key={objekt.id}
              objekt={objekt}
              verdi={feltVerdier[objekt.id] ?? null}
              onEndreVerdi={(v) => settFeltVerdi(objekt.id, v)}
              leseModus={DISPLAY_TYPER.has(objekt.type)}
            />
          );
        })}
      </ScrollView>

      {/* Bunnknapper — Forrige + Neste */}
      <View className="flex-row gap-2 border-t border-gray-200 bg-white px-4 py-3">
        {aktivSeksjon > 0 && (
          <TouchableOpacity
            onPress={() => {
              setAktivSeksjon(aktivSeksjon - 1);
              setHarScrolletTilBunn(false);
              setInnholdKortNok(false);
              scrollRef.current?.scrollTo({ y: 0, animated: true });
            }}
            className="rounded-lg border border-gray-200 px-4 py-3"
          >
            <Text className="text-sm font-medium text-gray-600">Forrige</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={gåTilNeste}
          disabled={!kanGåVidere || fullforMut.isPending}
          className={`flex-1 flex-row items-center justify-center rounded-lg py-3 ${
            kanGåVidere
              ? erSignaturSeksjon ? "bg-green-600" : "bg-sitedoc-primary"
              : "bg-gray-200"
          }`}
        >
          {fullforMut.isPending ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Text className={`text-sm font-semibold ${kanGåVidere ? "text-white" : "text-gray-400"}`}>
                {erSignaturSeksjon ? "Bekreft og signer" : "Neste"}
              </Text>
              {!erSignaturSeksjon && kanGåVidere && <ChevronRight size={18} color="#ffffff" className="ml-1" />}
              {erSignaturSeksjon && kanGåVidere && <Check size={18} color="#ffffff" className="ml-1" />}
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function Header({ onTilbake, tittel, ekstra }: { onTilbake: () => void; tittel: string; ekstra?: React.ReactNode }) {
  return (
    <View className="flex-row items-center border-b border-gray-200 px-3 py-2.5">
      <TouchableOpacity onPress={onTilbake} className="mr-2 rounded-lg p-1.5">
        <ArrowLeft size={22} color="#374151" />
      </TouchableOpacity>
      <Text className="flex-1 text-sm font-semibold text-gray-900" numberOfLines={1}>
        {tittel}
      </Text>
      {ekstra}
    </View>
  );
}
