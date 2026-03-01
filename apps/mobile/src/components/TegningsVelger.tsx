import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  FlatList,
  Modal,
} from "react-native";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Check,
  Search,
  Map,
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface Bygning {
  id: string;
  name: string;
}

interface Tegning {
  id: string;
  name: string;
  drawingNumber: string | null;
  discipline: string | null;
  floor: string | null;
  buildingId: string | null;
  _count: { revisions: number };
}

interface TegningsVelgerProps {
  bygninger: Bygning[];
  tegninger: Tegning[];
  valgtBygningId: string | null;
  valgtTegningId: string | null;
  onVelgBygning: (id: string | null) => void;
  onVelgTegning: (id: string) => void;
  onAvbryt: () => void;
  laster: boolean;
}

interface EtasjeGruppe {
  etasje: string;
  tegninger: Tegning[];
}

export function TegningsVelger({
  bygninger,
  tegninger,
  valgtBygningId,
  valgtTegningId,
  onVelgBygning,
  onVelgTegning,
  onAvbryt,
  laster,
}: TegningsVelgerProps) {
  const [utvidet, setUtvidet] = useState(false);
  const [søkTekst, setSøkTekst] = useState("");
  const [åpneEtasjer, setÅpneEtasjer] = useState<Set<string>>(new Set());
  const [visBygningListe, setVisBygningListe] = useState(false);

  // Filtrer tegninger basert på valgt bygning og søketekst
  const filtreretTegninger = useMemo(() => {
    let resultat = tegninger;

    if (valgtBygningId) {
      resultat = resultat.filter((t) => t.buildingId === valgtBygningId);
    }

    if (søkTekst.trim()) {
      const søk = søkTekst.toLowerCase();
      resultat = resultat.filter(
        (t) =>
          t.name.toLowerCase().includes(søk) ||
          (t.drawingNumber && t.drawingNumber.toLowerCase().includes(søk)) ||
          (t.discipline && t.discipline.toLowerCase().includes(søk)),
      );
    }

    return resultat;
  }, [tegninger, valgtBygningId, søkTekst]);

  // Grupper tegninger etter etasje
  const etasjeGrupper = useMemo(() => {
    const grupper: Record<string, Tegning[]> = {};

    for (const tegning of filtreretTegninger) {
      const etasje = tegning.floor || "Uten etasje";
      if (!grupper[etasje]) {
        grupper[etasje] = [];
      }
      grupper[etasje].push(tegning);
    }

    const sortert: EtasjeGruppe[] = Object.entries(grupper)
      .sort(([a], [b]) => {
        if (a === "Uten etasje") return 1;
        if (b === "Uten etasje") return -1;
        return a.localeCompare(b, "nb-NO", { numeric: true });
      })
      .map(([etasje, tegningerIGruppe]) => ({
        etasje,
        tegninger: tegningerIGruppe,
      }));

    return sortert;
  }, [filtreretTegninger]);

  // Finn gjeldende etasje/bygningsnavn for kollapset visning
  const valgtTegning = tegninger.find((t) => t.id === valgtTegningId);
  const valgtBygning = bygninger.find((b) => b.id === valgtBygningId);
  const kollapsetTekst = valgtTegning
    ? valgtTegning.floor || valgtTegning.name
    : valgtBygning
      ? valgtBygning.name
      : "Velg tegning";

  const toggleEtasje = useCallback((etasje: string) => {
    setÅpneEtasjer((prev) => {
      const neste = new Set(prev);
      if (neste.has(etasje)) {
        neste.delete(etasje);
      } else {
        neste.add(etasje);
      }
      return neste;
    });
  }, []);

  const håndterVelgTegning = useCallback(
    (id: string) => {
      onVelgTegning(id);
      setUtvidet(false);
    },
    [onVelgTegning],
  );

  const renderEtasjeGruppe = ({ item }: { item: EtasjeGruppe }) => {
    const erÅpen = åpneEtasjer.has(item.etasje);

    return (
      <View>
        <Pressable
          onPress={() => toggleEtasje(item.etasje)}
          className="flex-row items-center border-b border-gray-100 bg-gray-50 px-4 py-2.5"
        >
          {erÅpen ? (
            <ChevronDown size={16} color="#6b7280" />
          ) : (
            <ChevronRight size={16} color="#6b7280" />
          )}
          <Text className="ml-2 flex-1 text-sm font-semibold text-gray-700">
            {item.etasje}
          </Text>
          <Text className="text-xs text-gray-400">
            {item.tegninger.length}
          </Text>
        </Pressable>

        {erÅpen &&
          item.tegninger.map((tegning) => {
            const erValgt = tegning.id === valgtTegningId;
            return (
              <Pressable
                key={tegning.id}
                onPress={() => håndterVelgTegning(tegning.id)}
                className={`flex-row items-center border-b border-gray-50 px-4 py-2.5 pl-10 ${erValgt ? "bg-blue-50" : "bg-white"}`}
              >
                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    {tegning.drawingNumber && (
                      <Text className="text-xs font-medium text-gray-500">
                        {tegning.drawingNumber}
                      </Text>
                    )}
                    <Text
                      className={`text-sm ${erValgt ? "font-semibold text-blue-700" : "text-gray-800"}`}
                      numberOfLines={1}
                    >
                      {tegning.name}
                    </Text>
                  </View>
                </View>
                <View className="flex-row items-center gap-2">
                  {erValgt && <Check size={16} color="#1e40af" />}
                  {tegning._count.revisions > 0 && (
                    <View className="rounded-full bg-gray-200 px-1.5 py-0.5">
                      <Text className="text-[10px] font-medium text-gray-600">
                        {tegning._count.revisions}
                      </Text>
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })}
      </View>
    );
  };

  return (
    <>
      {/* Kollapset bar — alltid synlig over tab-baren */}
      <Pressable
        onPress={() => setUtvidet(true)}
        className="flex-row items-center justify-between border-t border-gray-200 bg-white px-4 py-3"
      >
        <View className="flex-row items-center gap-2">
          <Map size={18} color="#1e40af" />
          <Text className="text-sm font-medium text-gray-700">
            {kollapsetTekst}
          </Text>
        </View>
        <ChevronUp size={18} color="#9ca3af" />
      </Pressable>

      {/* Utvidet modal med tegningsliste */}
      <Modal visible={utvidet} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView className="flex-1 bg-white">
          {/* Grønn header med Avbryt og bygningsvelger */}
          <View className="flex-row items-center justify-between bg-siteflow-blue px-4 py-3">
            <Pressable
              onPress={() => {
                setUtvidet(false);
                onAvbryt();
              }}
              hitSlop={8}
            >
              <Text className="text-sm font-medium text-white">Avbryt</Text>
            </Pressable>

            <Pressable
              onPress={() => setVisBygningListe(!visBygningListe)}
              className="flex-row items-center gap-1"
            >
              <Text className="text-sm font-semibold text-white">
                {valgtBygning?.name ?? "Alle bygninger"}
              </Text>
              <ChevronDown size={16} color="#ffffff" />
            </Pressable>

            <Pressable onPress={() => setUtvidet(false)} hitSlop={8}>
              <Text className="text-sm font-medium text-white">Ferdig</Text>
            </Pressable>
          </View>

          {/* Bygningsvelger-dropdown */}
          {visBygningListe && (
            <View className="border-b border-gray-200 bg-white px-4">
              <Pressable
                onPress={() => {
                  onVelgBygning(null);
                  setVisBygningListe(false);
                }}
                className="flex-row items-center border-b border-gray-100 py-3"
              >
                <Text
                  className={`flex-1 text-sm ${!valgtBygningId ? "font-semibold text-blue-700" : "text-gray-700"}`}
                >
                  Alle bygninger
                </Text>
                {!valgtBygningId && <Check size={18} color="#1e40af" />}
              </Pressable>
              {bygninger.map((bygning) => (
                <Pressable
                  key={bygning.id}
                  onPress={() => {
                    onVelgBygning(bygning.id);
                    setVisBygningListe(false);
                  }}
                  className="flex-row items-center border-b border-gray-100 py-3"
                >
                  <Text
                    className={`flex-1 text-sm ${valgtBygningId === bygning.id ? "font-semibold text-blue-700" : "text-gray-700"}`}
                  >
                    {bygning.name}
                  </Text>
                  {valgtBygningId === bygning.id && (
                    <Check size={18} color="#1e40af" />
                  )}
                </Pressable>
              ))}
            </View>
          )}

          {/* Søkefelt */}
          <View className="border-b border-gray-200 bg-gray-50 px-4 py-2">
            <View className="flex-row items-center rounded-lg bg-white px-3 py-2">
              <Search size={16} color="#9ca3af" />
              <TextInput
                className="ml-2 flex-1 text-sm text-gray-800"
                placeholder="Søk tegninger…"
                placeholderTextColor="#9ca3af"
                value={søkTekst}
                onChangeText={setSøkTekst}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Innhold */}
          {laster ? (
            <View className="flex-1 items-center justify-center py-8">
              <Text className="text-sm text-gray-400">Henter tegninger…</Text>
            </View>
          ) : filtreretTegninger.length === 0 ? (
            <View className="flex-1 items-center justify-center py-8">
              <Text className="text-sm text-gray-400">
                {søkTekst
                  ? "Ingen tegninger funnet"
                  : "Ingen tegninger tilgjengelig"}
              </Text>
            </View>
          ) : (
            <FlatList
              data={etasjeGrupper}
              keyExtractor={(item) => item.etasje}
              renderItem={renderEtasjeGruppe}
              contentContainerStyle={{ paddingBottom: 40 }}
            />
          )}
        </SafeAreaView>
      </Modal>
    </>
  );
}
