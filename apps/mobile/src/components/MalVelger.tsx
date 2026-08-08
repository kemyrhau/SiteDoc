import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  Modal,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native";
import { X, ChevronDown, ChevronRight } from "lucide-react-native";
import { trpc } from "../lib/trpc";
import { useProsjekt } from "../kontekst/ProsjektKontekst";

interface MalData {
  id: string;
  name: string;
  prefix: string | null;
  category: string;
  subjects?: string[];
  // P4b pkt 0: opprettbarhet fra serveren (delt regel med opprett-valideringen).
  opprettbar?: boolean;
  // Flytresolusjon: de opprettbare flyt-idene (delt regel) bæres videre til
  // opprett-modalen, som bruker dem til flyt-valg (én sannhet med velgeren).
  opprettbareFlytIder?: string[];
}

interface MalVelgerProps {
  synlig: boolean;
  kategori: "sjekkliste" | "oppgave";
  onVelg: (mal: MalData) => void;
  onLukk: () => void;
}

export function MalVelger({ synlig, kategori, onVelg, onLukk }: MalVelgerProps) {
  const { valgtProsjektId } = useProsjekt();

  const malQuery = trpc.mal.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId && synlig },
  );

  const maler = malQuery.data as MalData[] | undefined;
  const [visUtilgjengelige, setVisUtilgjengelige] = useState(false);

  // P4a: serialiser overrekkelsen til opprett-modalen. På iOS kan ikke to native
  // modaler transisjonere samtidig — presenteres opprett-modalen (fullScreen) mens
  // denne velgeren (pageSheet) fortsatt dismisses, feiler presentasjonen og skjermen
  // blir svart. `internSynlig` speiler `synlig`-propen, men settes lokalt false ved
  // valg så velgeren animerer HELT ut (onDismiss) FØR `onVelg` presenterer opprett-
  // modalen. Android har ingen slik VC-kollisjon (og `onDismiss` fyres uansett ikke
  // der) → velg direkte. (Auto-velg-grenen under rendrer aldri Modal → ingen
  // kollisjon, kaller `onVelg` direkte.)
  const [internSynlig, setInternSynlig] = useState(synlig);
  useEffect(() => {
    setInternSynlig(synlig);
  }, [synlig]);
  const ventendeMal = useRef<MalData | null>(null);
  useEffect(() => {
    if (!synlig) ventendeMal.current = null;
  }, [synlig]);

  const velg = (mal: MalData) => {
    if (Platform.OS === "ios") {
      ventendeMal.current = mal;
      setInternSynlig(false);
    } else {
      onVelg(mal);
    }
  };

  // iOS: velgeren er helt dismisset → trygt å presentere opprett-modalen.
  const håndterDismiss = () => {
    if (ventendeMal.current) {
      const mal = ventendeMal.current;
      ventendeMal.current = null;
      onVelg(mal);
    }
  };

  const kategoriMaler = useMemo(
    () => maler?.filter((m) => m.category === kategori) ?? [],
    [maler, kategori],
  );
  // P4b pkt 0: velger + auto-velg bruker KUN opprettbare maler (server-feltet,
  // delt regel med opprett-valideringen). Utilgjengelige vises bak «vis (N)».
  const filtrerteMaler = useMemo(
    () => kategoriMaler.filter((m) => m.opprettbar !== false),
    [kategoriMaler],
  );
  const utilgjengeligeMaler = useMemo(
    () => kategoriMaler.filter((m) => m.opprettbar === false),
    [kategoriMaler],
  );

  // Klikk-kutt: nøyaktig 1 mal → hopp over velgeren og velg den automatisk
  // (malen vises uansett som felt i opprett-skjemaet). Én gang per åpning.
  const skalAutoVelge = !malQuery.isLoading && filtrerteMaler.length === 1;
  const harAutoValgt = useRef(false);
  useEffect(() => {
    if (!synlig) {
      harAutoValgt.current = false;
      return;
    }
    if (skalAutoVelge && !harAutoValgt.current) {
      harAutoValgt.current = true;
      onVelg(filtrerteMaler[0]);
    }
  }, [synlig, skalAutoVelge, filtrerteMaler, onVelg]);

  // Ved auto-velg (eller mens maler lastes) rendres IKKE velger-modalen — så
  // den aldri sklir inn og ut samtidig som opprett-modalen animeres inn (to
  // samtidige pageSheet-modaler kolliderer på iOS). Kun ≥2 maler viser velger.
  if (synlig && (malQuery.isLoading || skalAutoVelge)) return null;

  return (
    <Modal
      visible={internSynlig}
      animationType="slide"
      presentationStyle="pageSheet"
      onDismiss={håndterDismiss}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: "#ffffff" }}>
        {/* Header */}
        <View className="flex-row items-center justify-between bg-sitedoc-blue px-4 py-3">
          <Text className="text-sm font-semibold text-white">
            Velg {kategori === "sjekkliste" ? "sjekklistemal" : "oppgavemal"}
          </Text>
          <Pressable onPress={onLukk} hitSlop={12}>
            <X size={20} color="#ffffff" />
          </Pressable>
        </View>

        {malQuery.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#1e40af" />
            <Text className="mt-3 text-sm text-gray-500">Henter maler...</Text>
          </View>
        ) : filtrerteMaler.length === 0 && utilgjengeligeMaler.length === 0 ? (
          <View className="flex-1 items-center justify-center px-4">
            <Text className="text-base text-gray-500">
              Ingen {kategori === "sjekkliste" ? "sjekkliste" : "oppgave"}maler funnet
            </Text>
          </View>
        ) : (
          <FlatList
            data={filtrerteMaler}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => velg(item)}
                className="flex-row items-center border-b border-gray-100 bg-white px-4 py-3.5"
              >
                <View className="flex-1">
                  <Text className="text-sm font-medium text-gray-900">
                    {item.name}
                  </Text>
                </View>
                {item.prefix ? (
                  <View className="rounded bg-gray-100 px-2 py-1">
                    <Text className="text-xs font-medium text-gray-600">
                      {item.prefix}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            )}
            ListFooterComponent={
              utilgjengeligeMaler.length > 0 ? (
                // P4b pkt 0: utilgjengelige maler (kan ikke opprettes) bak «vis (N)».
                <View className="border-t border-gray-100">
                  <Pressable
                    onPress={() => setVisUtilgjengelige((v) => !v)}
                    className="flex-row items-center gap-1.5 px-4 py-3"
                  >
                    {visUtilgjengelige ? (
                      <ChevronDown size={16} color="#9ca3af" />
                    ) : (
                      <ChevronRight size={16} color="#9ca3af" />
                    )}
                    <Text className="text-xs font-semibold uppercase text-gray-400">
                      Vis utilgjengelige ({utilgjengeligeMaler.length})
                    </Text>
                  </Pressable>
                  {visUtilgjengelige &&
                    utilgjengeligeMaler.map((item) => (
                      <View
                        key={item.id}
                        className="border-b border-gray-100 bg-white px-4 py-3.5 opacity-60"
                      >
                        <Text className="text-sm font-medium text-gray-500">{item.name}</Text>
                        <Text className="text-xs text-gray-400">
                          Ingen av dine dokumentflyter bruker denne malen
                        </Text>
                      </View>
                    ))}
                </View>
              ) : null
            }
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}
