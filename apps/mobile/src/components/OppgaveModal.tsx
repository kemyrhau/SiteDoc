import { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MapPin, ChevronDown } from "lucide-react-native";
import { trpc } from "../lib/trpc";
import { useProsjekt } from "../kontekst/ProsjektKontekst";

type Prioritet = "low" | "medium" | "high" | "critical";

interface EntrepriseData {
  id: string;
  name: string;
}

interface OppgaveModalProps {
  synlig: boolean;
  onLukk: () => void;
  onOpprettet: (oppgaveId: string) => void;
  tegningNavn: string;
  tegningId: string;
  posisjonX: number;
  posisjonY: number;
  gpsPositionert?: boolean;
  templateId: string;
}

const PRIORITETER: { verdi: Prioritet; label: string }[] = [
  { verdi: "low", label: "Lav" },
  { verdi: "medium", label: "Medium" },
  { verdi: "high", label: "Høy" },
  { verdi: "critical", label: "Kritisk" },
];

const PRIORITET_FARGER: Record<Prioritet, string> = {
  low: "bg-gray-200 text-gray-700",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

export function OppgaveModal({
  synlig,
  onLukk,
  onOpprettet,
  tegningNavn,
  tegningId,
  posisjonX,
  posisjonY,
  gpsPositionert,
  templateId,
}: OppgaveModalProps) {
  const { valgtProsjektId } = useProsjekt();

  const [tittel, setTittel] = useState("");
  const [beskrivelse, setBeskrivelse] = useState("");
  const [prioritet, setPrioritet] = useState<Prioritet>("medium");
  const [oppretterEntrepriseId, setOppretterEntrepriseId] = useState<string | null>(null);
  const [svarerEntrepriseId, setSvarerEntrepriseId] = useState<string | null>(null);
  const [visOppretterListe, setVisOppretterListe] = useState(false);
  const [visSvarerListe, setVisSvarerListe] = useState(false);

  // Hent entrepriser for prosjektet
  const entrepriseQuery = trpc.entreprise.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId && synlig },
  );

  const entrepriser = (entrepriseQuery.data ?? []) as EntrepriseData[];

  const opprettMutasjon = trpc.oppgave.opprett.useMutation({
    onSuccess: (_data: unknown, _variabler: { title: string }) => {
      nullstillSkjema();
      onOpprettet((_data as { id: string }).id);
    },
    onError: (feil: { message?: string }) => {
      Alert.alert("Feil", feil.message || "Kunne ikke opprette oppgave");
    },
  });

  const nullstillSkjema = useCallback(() => {
    setTittel("");
    setBeskrivelse("");
    setPrioritet("medium");
    setOppretterEntrepriseId(null);
    setSvarerEntrepriseId(null);
    setVisOppretterListe(false);
    setVisSvarerListe(false);
  }, []);

  const håndterAvbryt = useCallback(() => {
    nullstillSkjema();
    onLukk();
  }, [nullstillSkjema, onLukk]);

  const håndterOpprett = useCallback(async () => {
    if (!tittel.trim()) {
      Alert.alert("Mangler tittel", "Skriv inn en tittel for oppgaven");
      return;
    }
    if (!oppretterEntrepriseId) {
      Alert.alert("Mangler oppretter", "Velg en oppretter-entreprise");
      return;
    }
    if (!svarerEntrepriseId) {
      Alert.alert("Mangler svarer", "Velg en svarer-entreprise");
      return;
    }

    opprettMutasjon.mutate({
      creatorEnterpriseId: oppretterEntrepriseId,
      responderEnterpriseId: svarerEntrepriseId,
      title: tittel.trim(),
      description: beskrivelse.trim() || undefined,
      priority: prioritet,
      templateId,
      drawingId: tegningId,
      positionX: posisjonX,
      positionY: posisjonY,
    });
  }, [
    tittel,
    beskrivelse,
    prioritet,
    oppretterEntrepriseId,
    svarerEntrepriseId,
    templateId,
    tegningId,
    posisjonX,
    posisjonY,
    opprettMutasjon,
  ]);

  const valgtOppretter = entrepriser.find((e) => e.id === oppretterEntrepriseId);
  const valgtSvarer = entrepriser.find((e) => e.id === svarerEntrepriseId);

  const kanOpprett =
    tittel.trim().length > 0 &&
    !!oppretterEntrepriseId &&
    !!svarerEntrepriseId &&
    !opprettMutasjon.isPending;

  return (
    <Modal visible={synlig} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1 bg-white">
        {/* Header */}
        <View className="flex-row items-center justify-between bg-siteflow-blue px-4 py-3">
          <Pressable onPress={håndterAvbryt} hitSlop={8}>
            <Text className="text-sm font-medium text-white">Avbryt</Text>
          </Pressable>
          <Text className="text-sm font-semibold text-white">Ny oppgave</Text>
          <Pressable
            onPress={håndterOpprett}
            disabled={!kanOpprett}
            hitSlop={8}
          >
            {opprettMutasjon.isPending ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text
                className={`text-sm font-medium ${kanOpprett ? "text-white" : "text-white/40"}`}
              >
                Opprett
              </Text>
            )}
          </Pressable>
        </View>

        <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
          {/* Tittel */}
          <View className="border-b border-gray-100 px-4 py-3">
            <Text className="mb-1 text-xs font-medium text-gray-500">
              Tittel *
            </Text>
            <TextInput
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800"
              placeholder="Skriv tittel…"
              placeholderTextColor="#9ca3af"
              value={tittel}
              onChangeText={setTittel}
              autoFocus
            />
          </View>

          {/* Beskrivelse */}
          <View className="border-b border-gray-100 px-4 py-3">
            <Text className="mb-1 text-xs font-medium text-gray-500">
              Beskrivelse
            </Text>
            <TextInput
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800"
              placeholder="Valgfri beskrivelse…"
              placeholderTextColor="#9ca3af"
              value={beskrivelse}
              onChangeText={setBeskrivelse}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              style={{ minHeight: 72 }}
            />
          </View>

          {/* Prioritet */}
          <View className="border-b border-gray-100 px-4 py-3">
            <Text className="mb-2 text-xs font-medium text-gray-500">
              Prioritet
            </Text>
            <View className="flex-row gap-2">
              {PRIORITETER.map((p) => {
                const erValgt = prioritet === p.verdi;
                return (
                  <Pressable
                    key={p.verdi}
                    onPress={() => setPrioritet(p.verdi)}
                    className={`rounded-full px-3 py-1.5 ${erValgt ? PRIORITET_FARGER[p.verdi] : "bg-gray-100"}`}
                  >
                    <Text
                      className={`text-xs font-medium ${erValgt ? "" : "text-gray-500"}`}
                    >
                      {p.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Oppretter-entreprise */}
          <View className="border-b border-gray-100 px-4 py-3">
            <Text className="mb-1 text-xs font-medium text-gray-500">
              Oppretter-entreprise *
            </Text>
            <Pressable
              onPress={() => {
                setVisOppretterListe(!visOppretterListe);
                setVisSvarerListe(false);
              }}
              className="flex-row items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5"
            >
              <Text
                className={`text-sm ${valgtOppretter ? "text-gray-800" : "text-gray-400"}`}
              >
                {valgtOppretter?.name ?? "Velg entreprise…"}
              </Text>
              <ChevronDown size={16} color="#9ca3af" />
            </Pressable>
            {visOppretterListe && (
              <View className="mt-1 rounded-lg border border-gray-200 bg-white">
                {entrepriser.map((e) => (
                  <Pressable
                    key={e.id}
                    onPress={() => {
                      setOppretterEntrepriseId(e.id);
                      setVisOppretterListe(false);
                    }}
                    className={`border-b border-gray-50 px-3 py-2.5 ${oppretterEntrepriseId === e.id ? "bg-blue-50" : ""}`}
                  >
                    <Text
                      className={`text-sm ${oppretterEntrepriseId === e.id ? "font-medium text-blue-700" : "text-gray-700"}`}
                    >
                      {e.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Svarer-entreprise */}
          <View className="border-b border-gray-100 px-4 py-3">
            <Text className="mb-1 text-xs font-medium text-gray-500">
              Svarer-entreprise *
            </Text>
            <Pressable
              onPress={() => {
                setVisSvarerListe(!visSvarerListe);
                setVisOppretterListe(false);
              }}
              className="flex-row items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5"
            >
              <Text
                className={`text-sm ${valgtSvarer ? "text-gray-800" : "text-gray-400"}`}
              >
                {valgtSvarer?.name ?? "Velg entreprise…"}
              </Text>
              <ChevronDown size={16} color="#9ca3af" />
            </Pressable>
            {visSvarerListe && (
              <View className="mt-1 rounded-lg border border-gray-200 bg-white">
                {entrepriser.map((e) => (
                  <Pressable
                    key={e.id}
                    onPress={() => {
                      setSvarerEntrepriseId(e.id);
                      setVisSvarerListe(false);
                    }}
                    className={`border-b border-gray-50 px-3 py-2.5 ${svarerEntrepriseId === e.id ? "bg-blue-50" : ""}`}
                  >
                    <Text
                      className={`text-sm ${svarerEntrepriseId === e.id ? "font-medium text-blue-700" : "text-gray-700"}`}
                    >
                      {e.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Tegningsposisjon (kun lesbart) */}
          <View className="px-4 py-3">
            <Text className="mb-1 text-xs font-medium text-gray-500">
              Posisjon på tegning
            </Text>
            <View className={`flex-row items-center gap-2 rounded-lg px-3 py-2.5 ${gpsPositionert ? "bg-green-50" : "bg-blue-50"}`}>
              <MapPin size={16} color={gpsPositionert ? "#059669" : "#1e40af"} />
              <View>
                <Text className={`text-sm ${gpsPositionert ? "text-green-800" : "text-blue-800"}`}>
                  {tegningNavn} ({Math.round(posisjonX)}%, {Math.round(posisjonY)}
                  %)
                </Text>
                {gpsPositionert && (
                  <Text className="text-xs text-green-600">
                    Posisjon beregnet fra GPS
                  </Text>
                )}
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
