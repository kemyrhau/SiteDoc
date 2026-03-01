import { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  FlatList,
  Animated,
  PanResponder,
  useWindowDimensions,
} from "react-native";
import {
  ChevronDown,
  ChevronRight,
  Check,
  Search,
  GripHorizontal,
} from "lucide-react-native";

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
  const { height: skjermHøyde } = useWindowDimensions();

  // Snap-punkter i piksler (8%, 50%, 90% av skjermhøyde)
  const snapPunkter = useMemo(
    () => [skjermHøyde * 0.08, skjermHøyde * 0.5, skjermHøyde * 0.9],
    [skjermHøyde],
  );

  const animertHøyde = useRef(new Animated.Value(snapPunkter[0])).current;
  const gjeldeneHøyde = useRef(snapPunkter[0]);

  // Oppdater gjeldende høyde når animert verdi endres
  animertHøyde.addListener(({ value }) => {
    gjeldeneHøyde.current = value;
  });

  const snapTilNærmeste = useCallback(
    (verdi: number) => {
      // Finn nærmeste snap-punkt
      let nærmeste = snapPunkter[0];
      let minAvstand = Math.abs(verdi - snapPunkter[0]);
      for (const punkt of snapPunkter) {
        const avstand = Math.abs(verdi - punkt);
        if (avstand < minAvstand) {
          minAvstand = avstand;
          nærmeste = punkt;
        }
      }
      Animated.spring(animertHøyde, {
        toValue: nærmeste,
        useNativeDriver: false,
        tension: 80,
        friction: 12,
      }).start();
    },
    [animertHøyde, snapPunkter],
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dy) > 5,
      onPanResponderMove: (_, gestureState) => {
        const nyHøyde = gjeldeneHøyde.current - gestureState.dy;
        const clamped = Math.max(
          snapPunkter[0],
          Math.min(snapPunkter[2], nyHøyde),
        );
        animertHøyde.setValue(clamped);
      },
      onPanResponderRelease: (_, gestureState) => {
        const nyHøyde = gjeldeneHøyde.current - gestureState.dy;
        snapTilNærmeste(nyHøyde);
      },
    }),
  ).current;

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
    const grupper = new Map<string, Tegning[]>();

    for (const tegning of filtreretTegninger) {
      const etasje = tegning.floor || "Uten etasje";
      const eksisterende = grupper.get(etasje) ?? [];
      eksisterende.push(tegning);
      grupper.set(etasje, eksisterende);
    }

    const sortert: EtasjeGruppe[] = Array.from(grupper.entries())
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

  const renderBygningListe = () => (
    <View className="px-4">
      <Pressable
        onPress={() => {
          onVelgBygning(null);
          setVisBygningListe(false);
        }}
        className="flex-row items-center border-b border-gray-100 py-3"
      >
        <Text
          className={`flex-1 text-sm ${!valgtBygningId ? "font-semibold text-green-700" : "text-gray-700"}`}
        >
          Alle bygninger
        </Text>
        {!valgtBygningId && <Check size={18} color="#15803d" />}
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
            className={`flex-1 text-sm ${valgtBygningId === bygning.id ? "font-semibold text-green-700" : "text-gray-700"}`}
          >
            {bygning.name}
          </Text>
          {valgtBygningId === bygning.id && (
            <Check size={18} color="#15803d" />
          )}
        </Pressable>
      ))}
    </View>
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
                onPress={() => onVelgTegning(tegning.id)}
                className={`flex-row items-center border-b border-gray-50 px-4 py-2.5 pl-10 ${erValgt ? "bg-green-50" : "bg-white"}`}
              >
                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    {tegning.drawingNumber && (
                      <Text className="text-xs font-medium text-gray-500">
                        {tegning.drawingNumber}
                      </Text>
                    )}
                    <Text
                      className={`text-sm ${erValgt ? "font-semibold text-green-700" : "text-gray-800"}`}
                      numberOfLines={1}
                    >
                      {tegning.name}
                    </Text>
                  </View>
                </View>
                <View className="flex-row items-center gap-2">
                  {erValgt && <Check size={16} color="#15803d" />}
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
    <Animated.View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: animertHøyde,
        backgroundColor: "#ffffff",
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 10,
      }}
    >
      {/* Drag-håndtak */}
      <View {...panResponder.panHandlers} className="items-center py-2">
        <GripHorizontal size={24} color="#d1d5db" />
      </View>

      {/* Kollapset header-tekst */}
      <View className="border-b border-gray-200 px-4 pb-2">
        <Text className="text-center text-sm font-medium text-gray-600">
          {kollapsetTekst}
        </Text>
      </View>

      {/* Grønn header med Avbryt og bygningsvelger */}
      <View className="flex-row items-center justify-between bg-green-700 px-4 py-2.5">
        <Pressable onPress={onAvbryt} hitSlop={8}>
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

        <View style={{ width: 50 }} />
      </View>

      {/* Bygningsvelger-dropdown */}
      {visBygningListe && renderBygningListe()}

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
    </Animated.View>
  );
}
