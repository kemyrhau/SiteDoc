import { useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native";
import { MapPin, ChevronDown, ArrowRight } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { trpc } from "../lib/trpc";
import { useProsjekt } from "../kontekst/ProsjektKontekst";

type Prioritet = "low" | "medium" | "high" | "critical";

interface FaggruppeData {
  id: string;
  name: string;
}

interface ArbeidsforlopData {
  id: string;
  name: string;
  faggruppeId: string;
  utforerFaggruppeId: string | null;
  utforerFaggruppe: { id: string; name: string } | null;
  templates: Array<{
    templateId: string;
    template: { id: string; name: string; category: string };
  }>;
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
  const { t } = useTranslation();
  const { valgtProsjektId } = useProsjekt();

  const [prioritet, setPrioritet] = useState<Prioritet>("medium");
  const [oppretterFaggruppeId, setOppretterFaggruppeId] = useState<string | null>(null);
  const [svarerFaggruppeId, setSvarerFaggruppeId] = useState<string | null>(null);
  const [visSvarerListe, setVisSvarerListe] = useState(false);

  // Hent brukerens faggrupper
  const mineFaggrupperQuery = trpc.medlem.hentMineFaggrupper.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId && synlig },
  );
  const mineFaggrupper = (mineFaggrupperQuery.data ?? []) as FaggruppeData[];

  // Hent alle faggrupper for svarer-valg
  const faggruppeQuery = trpc.faggruppe.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId && synlig },
  );
  const faggrupper = (faggruppeQuery.data ?? []) as FaggruppeData[];

  // Hent arbeidsforløp for auto-utledning av svarer
  const arbeidsforlopQuery = trpc.arbeidsforlop.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId && synlig },
  );
  const alleArbeidsforlop = (arbeidsforlopQuery.data ?? []) as ArbeidsforlopData[];

  // Auto-velg oppretter: brukerens første faggruppe
  useEffect(() => {
    if (mineFaggrupper.length > 0 && !oppretterFaggruppeId) {
      setOppretterFaggruppeId(mineFaggrupper[0].id);
    }
  }, [mineFaggrupper, oppretterFaggruppeId]);

  // Auto-utled svarer fra arbeidsforløp
  const matchendeArbeidsforlop = useMemo(() => {
    if (!oppretterFaggruppeId) return null;
    const treff = alleArbeidsforlop.filter(
      (af) =>
        af.faggruppeId === oppretterFaggruppeId &&
        af.templates.some((t) => t.templateId === templateId),
    );
    return treff[0] ?? null;
  }, [alleArbeidsforlop, oppretterFaggruppeId, templateId]);

  // Svarer: fra arbeidsforløp, eller samme som oppretter (standard)
  const autoSvarerFaggruppeId = matchendeArbeidsforlop
    ? matchendeArbeidsforlop.utforerFaggruppeId ?? matchendeArbeidsforlop.faggruppeId
    : oppretterFaggruppeId;

  // Sett svarer automatisk når oppretter endres
  useEffect(() => {
    if (autoSvarerFaggruppeId && !svarerFaggruppeId) {
      setSvarerFaggruppeId(autoSvarerFaggruppeId);
    }
  }, [autoSvarerFaggruppeId, svarerFaggruppeId]);

  // Oppdater svarer når oppretter endres
  useEffect(() => {
    if (oppretterFaggruppeId) {
      setSvarerFaggruppeId(autoSvarerFaggruppeId);
    }
  }, [oppretterFaggruppeId, autoSvarerFaggruppeId]);

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
    setPrioritet("medium");
    setOppretterFaggruppeId(null);
    setSvarerFaggruppeId(null);
    setVisSvarerListe(false);
  }, []);

  const håndterAvbryt = useCallback(() => {
    nullstillSkjema();
    onLukk();
  }, [nullstillSkjema, onLukk]);

  const håndterOpprett = useCallback(async () => {
    if (!oppretterFaggruppeId) {
      Alert.alert("Mangler oppretter", "Velg en oppretter-faggruppe");
      return;
    }

    const effektivSvarer = svarerFaggruppeId ?? oppretterFaggruppeId;

    opprettMutasjon.mutate({
      bestillerFaggruppeId: oppretterFaggruppeId,
      utforerFaggruppeId: effektivSvarer,
      title: `Oppgave — ${tegningNavn}`,
      priority: prioritet,
      templateId,
      drawingId: tegningId,
      positionX: posisjonX,
      positionY: posisjonY,

    });
  }, [
    oppretterFaggruppeId,
    svarerFaggruppeId,
    prioritet,
    templateId,
    tegningId,
    tegningNavn,
    posisjonX,
    posisjonY,
    matchendeArbeidsforlop,
    opprettMutasjon,
  ]);

  const valgtOppretter = faggrupper.find((e) => e.id === oppretterFaggruppeId);
  const valgtSvarer = faggrupper.find((e) => e.id === svarerFaggruppeId);

  const kanOpprett = !!oppretterFaggruppeId && !opprettMutasjon.isPending;

  return (
    <Modal visible={synlig} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1 bg-white">
        {/* Header */}
        <View className="flex-row items-center justify-between bg-sitedoc-blue px-4 py-3">
          <Pressable onPress={håndterAvbryt} hitSlop={8}>
            <Text className="text-sm font-medium text-white">{t("handling.avbryt")}</Text>
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
          {/* Tegningsposisjon */}
          <View className="border-b border-gray-100 px-4 py-3">
            <Text className="mb-1 text-xs font-medium text-gray-500">
              Tegning
            </Text>
            <View className={`flex-row items-center gap-2 rounded-lg px-3 py-2.5 ${gpsPositionert ? "bg-green-50" : "bg-blue-50"}`}>
              <MapPin size={16} color={gpsPositionert ? "#059669" : "#1e40af"} />
              <View className="flex-1">
                <Text className={`text-sm ${gpsPositionert ? "text-green-800" : "text-blue-800"}`}>
                  {tegningNavn}
                </Text>
                {gpsPositionert && (
                  <Text className="text-xs text-green-600">
                    GPS-posisjon
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Faggruppe-flyt: Oppretter → Svarer */}
          <View className="border-b border-gray-100 px-4 py-3">
            <Text className="mb-2 text-xs font-medium text-gray-500">
              Faggruppe
            </Text>

            {/* Oppretter — auto-valgt, vises som tekst (valgbar hvis flere) */}
            {mineFaggrupper.length > 1 ? (
              <View className="mb-2">
                <Text className="mb-1 text-xs text-gray-400">Fra</Text>
                {mineFaggrupper.map((e) => (
                  <Pressable
                    key={e.id}
                    onPress={() => {
                      setOppretterFaggruppeId(e.id);
                      setSvarerFaggruppeId(null);
                    }}
                    className={`mb-1 rounded-lg border px-3 py-2 ${
                      oppretterFaggruppeId === e.id
                        ? "border-blue-300 bg-blue-50"
                        : "border-gray-200 bg-gray-50"
                    }`}
                  >
                    <Text
                      className={`text-sm ${
                        oppretterFaggruppeId === e.id
                          ? "font-medium text-blue-700"
                          : "text-gray-700"
                      }`}
                    >
                      {e.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : valgtOppretter ? (
              <View className="mb-2">
                <Text className="mb-1 text-xs text-gray-400">Fra</Text>
                <View className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2">
                  <Text className="text-sm font-medium text-blue-700">
                    {valgtOppretter.name}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Pil */}
            <View className="my-1 items-center">
              <ArrowRight size={16} color="#9ca3af" style={{ transform: [{ rotate: "90deg" }] }} />
            </View>

            {/* Svarer */}
            <View>
              <Text className="mb-1 text-xs text-gray-400">Til</Text>
              <Pressable
                onPress={() => setVisSvarerListe(!visSvarerListe)}
                className={`flex-row items-center justify-between rounded-lg border px-3 py-2 ${
                  valgtSvarer ? "border-gray-300 bg-gray-50" : "border-gray-200 bg-gray-50"
                }`}
              >
                <Text className={`text-sm ${valgtSvarer ? "text-gray-800" : "text-gray-400"}`}>
                  {valgtSvarer?.name ?? "Velg svarer…"}
                </Text>
                <ChevronDown size={16} color="#9ca3af" />
              </Pressable>
              {visSvarerListe && (
                <View className="mt-1 rounded-lg border border-gray-200 bg-white">
                  {faggrupper.map((e) => (
                    <Pressable
                      key={e.id}
                      onPress={() => {
                        setSvarerFaggruppeId(e.id);
                        setVisSvarerListe(false);
                      }}
                      className={`border-b border-gray-50 px-3 py-2.5 ${
                        svarerFaggruppeId === e.id ? "bg-blue-50" : ""
                      }`}
                    >
                      <Text
                        className={`text-sm ${
                          svarerFaggruppeId === e.id ? "font-medium text-blue-700" : "text-gray-700"
                        }`}
                      >
                        {e.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* Prioritet */}
          <View className="px-4 py-3">
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
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
