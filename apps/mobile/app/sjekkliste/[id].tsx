import { useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Save } from "lucide-react-native";
import { harBetingelse } from "@siteflow/shared";
import { useSjekklisteSkjema } from "../../src/hooks/useSjekklisteSkjema";
import { StatusMerkelapp } from "../../src/components/StatusMerkelapp";
import { RapportObjektRenderer, DISPLAY_TYPER } from "../../src/components/rapportobjekter";
import { FeltWrapper } from "../../src/components/rapportobjekter/FeltWrapper";

export default function SjekklisteUtfylling() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const {
    sjekkliste,
    erLaster,
    hentFeltVerdi,
    settVerdi,
    settKommentar,
    leggTilVedlegg,
    fjernVedlegg,
    erSynlig,
    valideringsfeil,
    valider,
    lagre,
    erLagrer,
    harEndringer,
    erRedigerbar,
  } = useSjekklisteSkjema(id!);

  const håndterTilbake = useCallback(() => {
    if (harEndringer) {
      Alert.alert(
        "Ulagrede endringer",
        "Du har endringer som ikke er lagret. Vil du lagre før du går tilbake?",
        [
          { text: "Forkast", style: "destructive", onPress: () => router.back() },
          {
            text: "Lagre og gå tilbake",
            onPress: async () => {
              await lagre();
              router.back();
            },
          },
          { text: "Avbryt", style: "cancel" },
        ],
      );
    } else {
      router.back();
    }
  }, [harEndringer, lagre, router]);

  const håndterLagre = useCallback(async () => {
    const erGyldig = valider();
    if (!erGyldig) {
      Alert.alert("Valideringsfeil", "Fyll inn alle påkrevde felt før du lagrer.");
      return;
    }
    await lagre();
    Alert.alert("Lagret", "Utfyllingen er lagret.");
  }, [valider, lagre]);

  if (erLaster) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#1e40af" />
        <Text className="mt-3 text-sm text-gray-500">Henter sjekkliste...</Text>
      </SafeAreaView>
    );
  }

  if (!sjekkliste) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-gray-50">
        <Text className="text-base text-gray-500">Sjekklisten ble ikke funnet</Text>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text className="text-blue-600">Gå tilbake</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const objekter = sjekkliste.template.objects
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const leseModus = !erRedigerbar;

  return (
    <SafeAreaView className="flex-1 bg-gray-100" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between bg-siteflow-blue px-4 py-3">
        <Pressable onPress={håndterTilbake} hitSlop={12} className="flex-row items-center gap-2">
          <ArrowLeft size={22} color="#ffffff" />
        </Pressable>
        <Text className="flex-1 px-3 text-center text-base font-semibold text-white" numberOfLines={1}>
          {sjekkliste.title}
        </Text>
        {erRedigerbar && (
          <Pressable onPress={håndterLagre} hitSlop={12} disabled={erLagrer}>
            <Save size={22} color={erLagrer ? "#93c5fd" : "#ffffff"} />
          </Pressable>
        )}
        {!erRedigerbar && <View style={{ width: 22 }} />}
      </View>

      {/* Metadata-bar */}
      <View className="flex-row items-center justify-between border-b border-gray-200 bg-white px-4 py-2">
        <View className="flex-row items-center gap-2">
          {sjekkliste.template.prefix && (
            <Text className="text-xs font-medium text-gray-500">
              {sjekkliste.template.prefix}
            </Text>
          )}
          <Text className="text-sm text-gray-700" numberOfLines={1}>
            {sjekkliste.template.name}
          </Text>
        </View>
        <StatusMerkelapp status={sjekkliste.status} />
      </View>

      {/* Entrepriser */}
      <View className="flex-row border-b border-gray-200 bg-white px-4 py-1.5">
        {sjekkliste.creatorEnterprise && (
          <Text className="flex-1 text-xs text-gray-500">
            Oppretter: {sjekkliste.creatorEnterprise.name}
          </Text>
        )}
        {sjekkliste.responderEnterprise && (
          <Text className="flex-1 text-right text-xs text-gray-500">
            Svarer: {sjekkliste.responderEnterprise.name}
          </Text>
        )}
      </View>

      {/* Felter */}
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-2 p-3 pb-8"
        keyboardShouldPersistTaps="handled"
      >
        {objekter.map((objekt) => {
          // Sjekk synlighet (betinget felt)
          if (!erSynlig(objekt)) return null;

          const erDisplay = DISPLAY_TYPER.has(objekt.type);
          const erBetinget = harBetingelse(objekt.config);

          // Display-typer (heading, subtitle) rendres uten wrapper
          if (erDisplay) {
            return (
              <View key={objekt.id} className={erBetinget ? "ml-4 border-l-2 border-l-blue-300 pl-3" : ""}>
                <RapportObjektRenderer
                  objekt={objekt}
                  verdi={null}
                  onEndreVerdi={() => {}}
                  leseModus={leseModus}
                />
              </View>
            );
          }

          // Utfyllbare felt med FeltWrapper
          const feltVerdi = hentFeltVerdi(objekt.id);

          return (
            <FeltWrapper
              key={objekt.id}
              objekt={objekt}
              kommentar={feltVerdi.kommentar}
              vedlegg={feltVerdi.vedlegg}
              onEndreKommentar={(k) => settKommentar(objekt.id, k)}
              onLeggTilVedlegg={(v) => leggTilVedlegg(objekt.id, v)}
              onFjernVedlegg={(vId) => fjernVedlegg(objekt.id, vId)}
              leseModus={leseModus}
              sjekklisteId={sjekkliste.id}
              erBetinget={erBetinget}
              valideringsfeil={valideringsfeil[objekt.id]}
            >
              <RapportObjektRenderer
                objekt={objekt}
                verdi={feltVerdi.verdi}
                onEndreVerdi={(v) => settVerdi(objekt.id, v)}
                leseModus={leseModus}
              />
            </FeltWrapper>
          );
        })}
      </ScrollView>

      {/* Lagre-knapp i bunn */}
      {erRedigerbar && (
        <View className="border-t border-gray-200 bg-white px-4 py-3">
          <Pressable
            onPress={håndterLagre}
            disabled={erLagrer}
            className={`items-center rounded-lg py-3 ${erLagrer ? "bg-blue-400" : "bg-blue-600"}`}
          >
            <Text className="font-medium text-white">
              {erLagrer ? "Lagrer..." : "Lagre utfylling"}
            </Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}
