import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  BackHandler,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
  // Location-tvang (2026-08-19): server-avledet — malen har et aktivt (ubetinget)
  // location-objekt → posisjon (punkt på tegning) er påkrevd ved opprettelse.
  harAktivLocation?: boolean;
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

  // Malvalg: kall `onVelg` DIREKTE. Velgeren rendres som en absolutt-posisjonert
  // overlay I RN-TREET (ikke `<Modal presentationStyle="pageSheet">`), så det finnes
  // INGEN presentert native view controller å dismisse. Ved malvalg setter parenten
  // `valgtMal` → `synlig=false` → overlayen unmountes rett og slett, og auto-opprett
  // + navigasjon skyves uten et native ark som river seg ned samtidig.
  //
  // Bakgrunn: tidligere var dette et `<Modal>`. Under Fabric tegnet UIKit et faktisk
  // pageSheet-VC (grabber observert i Release-sim 2026-08-27). Ved malvalg dismisset
  // det arket i samme frame som navigasjonen ble skjøvet → svart, touch-fangende host
  // ble stående = frys. Tre runder (a29f89b2 serialisering, df86b817 onDismiss,
  // d4a76020 fjern opprett-modalens native VC) flyttet frysen ett ledd om gangen fordi
  // en kommentar feilaktig påsto at Fabric rendret `<Modal>` inline uten VC. Det gjorde
  // den ikke. Å fjerne selve det native arket her lukker klassen — ingen VC, intet
  // kappløp med navigasjonen.
  const velg = (mal: MalData) => {
    onVelg(mal);
  };

  // Android maskinvare-tilbake: native `<Modal>` fanget dette via `onRequestClose`.
  // En in-tree overlay gjør ikke det, så vi lukker eksplisitt mens overlayen er synlig.
  useEffect(() => {
    if (!synlig) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onLukk();
      return true;
    });
    return () => sub.remove();
  }, [synlig, onLukk]);

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

  // Ikke synlig → render ingenting (overlayen unmountes helt).
  if (!synlig) return null;
  // Ved auto-velg (eller mens maler lastes) rendres IKKE velgeren — den skal aldri
  // vises for så å forsvinne i samme øyeblikk som opprett-flyten navigerer videre.
  // Kun ≥2 maler viser velgeren.
  if (malQuery.isLoading || skalAutoVelge) return null;

  return (
    <View style={styles.overlay}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  // Fullskjerm-overlay i RN-treet — erstatter den native pageSheet-modalen. Høy
  // zIndex/elevation legger den over søsken-innhold; ugjennomsiktig hvit bakgrunn
  // fanger all touch så ingenting bak lekker gjennom.
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#ffffff",
    zIndex: 1000,
    elevation: 1000,
  },
});
