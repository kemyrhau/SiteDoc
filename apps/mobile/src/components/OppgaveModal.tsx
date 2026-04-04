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

interface EntrepriseData {
  id: string;
  name: string;
}

interface ArbeidsforlopData {
  id: string;
  name: string;
  enterpriseId: string;
  responderEnterpriseId: string | null;
  responderEnterprise: { id: string; name: string } | null;
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
  const [oppretterEntrepriseId, setOppretterEntrepriseId] = useState<string | null>(null);
  const [svarerEntrepriseId, setSvarerEntrepriseId] = useState<string | null>(null);
  const [visSvarerListe, setVisSvarerListe] = useState(false);

  // Hent brukerens entrepriser
  const mineEntrepriserQuery = trpc.medlem.hentMineEntrepriser.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId && synlig },
  );
  const mineEntrepriser = (mineEntrepriserQuery.data ?? []) as EntrepriseData[];

  // Hent alle entrepriser for svarer-valg
  const entrepriseQuery = trpc.entreprise.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId && synlig },
  );
  const entrepriser = (entrepriseQuery.data ?? []) as EntrepriseData[];

  // Hent arbeidsforløp for auto-utledning av svarer
  const arbeidsforlopQuery = trpc.arbeidsforlop.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId && synlig },
  );
  const alleArbeidsforlop = (arbeidsforlopQuery.data ?? []) as ArbeidsforlopData[];

  // Auto-velg oppretter: brukerens første entreprise
  useEffect(() => {
    if (mineEntrepriser.length > 0 && !oppretterEntrepriseId) {
      setOppretterEntrepriseId(mineEntrepriser[0].id);
    }
  }, [mineEntrepriser, oppretterEntrepriseId]);

  // Auto-utled svarer fra arbeidsforløp
  const matchendeArbeidsforlop = useMemo(() => {
    if (!oppretterEntrepriseId) return null;
    const treff = alleArbeidsforlop.filter(
      (af) =>
        af.enterpriseId === oppretterEntrepriseId &&
        af.templates.some((t) => t.templateId === templateId),
    );
    return treff[0] ?? null;
  }, [alleArbeidsforlop, oppretterEntrepriseId, templateId]);

  // Svarer: fra arbeidsforløp, eller samme som oppretter (standard)
  const autoSvarerEntrepriseId = matchendeArbeidsforlop
    ? matchendeArbeidsforlop.responderEnterpriseId ?? matchendeArbeidsforlop.enterpriseId
    : oppretterEntrepriseId;

  // Sett svarer automatisk når oppretter endres
  useEffect(() => {
    if (autoSvarerEntrepriseId && !svarerEntrepriseId) {
      setSvarerEntrepriseId(autoSvarerEntrepriseId);
    }
  }, [autoSvarerEntrepriseId, svarerEntrepriseId]);

  // Oppdater svarer når oppretter endres
  useEffect(() => {
    if (oppretterEntrepriseId) {
      setSvarerEntrepriseId(autoSvarerEntrepriseId);
    }
  }, [oppretterEntrepriseId, autoSvarerEntrepriseId]);

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
    setOppretterEntrepriseId(null);
    setSvarerEntrepriseId(null);
    setVisSvarerListe(false);
  }, []);

  const håndterAvbryt = useCallback(() => {
    nullstillSkjema();
    onLukk();
  }, [nullstillSkjema, onLukk]);

  const håndterOpprett = useCallback(async () => {
    if (!oppretterEntrepriseId) {
      Alert.alert("Mangler oppretter", "Velg en oppretter-entreprise");
      return;
    }

    const effektivSvarer = svarerEntrepriseId ?? oppretterEntrepriseId;

    opprettMutasjon.mutate({
      creatorEnterpriseId: oppretterEntrepriseId,
      responderEnterpriseId: effektivSvarer,
      title: `Oppgave — ${tegningNavn}`,
      priority: prioritet,
      templateId,
      drawingId: tegningId,
      positionX: posisjonX,
      positionY: posisjonY,
      workflowId: matchendeArbeidsforlop?.id,
    });
  }, [
    oppretterEntrepriseId,
    svarerEntrepriseId,
    prioritet,
    templateId,
    tegningId,
    tegningNavn,
    posisjonX,
    posisjonY,
    matchendeArbeidsforlop,
    opprettMutasjon,
  ]);

  const valgtOppretter = entrepriser.find((e) => e.id === oppretterEntrepriseId);
  const valgtSvarer = entrepriser.find((e) => e.id === svarerEntrepriseId);

  const kanOpprett = !!oppretterEntrepriseId && !opprettMutasjon.isPending;

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

          {/* Entreprise-flyt: Oppretter → Svarer */}
          <View className="border-b border-gray-100 px-4 py-3">
            <Text className="mb-2 text-xs font-medium text-gray-500">
              Entreprise
            </Text>

            {/* Oppretter — auto-valgt, vises som tekst (valgbar hvis flere) */}
            {mineEntrepriser.length > 1 ? (
              <View className="mb-2">
                <Text className="mb-1 text-xs text-gray-400">Fra</Text>
                {mineEntrepriser.map((e) => (
                  <Pressable
                    key={e.id}
                    onPress={() => {
                      setOppretterEntrepriseId(e.id);
                      setSvarerEntrepriseId(null);
                    }}
                    className={`mb-1 rounded-lg border px-3 py-2 ${
                      oppretterEntrepriseId === e.id
                        ? "border-blue-300 bg-blue-50"
                        : "border-gray-200 bg-gray-50"
                    }`}
                  >
                    <Text
                      className={`text-sm ${
                        oppretterEntrepriseId === e.id
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
                  {entrepriser.map((e) => (
                    <Pressable
                      key={e.id}
                      onPress={() => {
                        setSvarerEntrepriseId(e.id);
                        setVisSvarerListe(false);
                      }}
                      className={`border-b border-gray-50 px-3 py-2.5 ${
                        svarerEntrepriseId === e.id ? "bg-blue-50" : ""
                      }`}
                    >
                      <Text
                        className={`text-sm ${
                          svarerEntrepriseId === e.id ? "font-medium text-blue-700" : "text-gray-700"
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
