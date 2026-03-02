import { useState, useCallback, useMemo } from "react";
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
import { SafeAreaView } from "react-native";
import { ChevronDown } from "lucide-react-native";
import { trpc } from "../lib/trpc";
import { useProsjekt } from "../kontekst/ProsjektKontekst";

type Prioritet = "low" | "medium" | "high" | "critical";

interface EntrepriseData {
  id: string;
  name: string;
}

interface MalData {
  id: string;
  name: string;
  prefix: string | null;
  category: string;
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

interface BygningData {
  id: string;
  name: string;
}

interface TegningData {
  id: string;
  name: string;
  drawingNumber: string | null;
}

interface OpprettDokumentModalProps {
  synlig: boolean;
  kategori: "sjekkliste" | "oppgave";
  mal: MalData;
  onOpprettet: (id: string) => void;
  onLukk: () => void;
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

export function OpprettDokumentModal({
  synlig,
  kategori,
  mal,
  onOpprettet,
  onLukk,
}: OpprettDokumentModalProps) {
  const { valgtProsjektId } = useProsjekt();

  const [emne, setEmne] = useState("");
  const [prioritet, setPrioritet] = useState<Prioritet>("medium");
  const [oppretterEntrepriseId, setOppretterEntrepriseId] = useState<string | null>(null);
  const [valgtBygningId, setValgtBygningId] = useState<string | null>(null);
  const [valgtTegningId, setValgtTegningId] = useState<string | null>(null);
  const [visOppretterListe, setVisOppretterListe] = useState(false);
  const [visBygningListe, setVisBygningListe] = useState(false);
  const [visTegningListe, setVisTegningListe] = useState(false);

  // Hent prosjektnavn for auto-tittel
  const prosjektQuery = trpc.prosjekt.hentMine.useQuery(undefined, {
    enabled: synlig,
  });
  const prosjekter = prosjektQuery.data ?? [];
  const valgtProsjekt = prosjekter.find((p: { id: string }) => p.id === valgtProsjektId);
  const prosjektNavn = valgtProsjekt?.name ?? "";

  const entrepriseQuery = trpc.entreprise.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId && synlig },
  );
  const entrepriser = (entrepriseQuery.data ?? []) as EntrepriseData[];

  // Hent arbeidsforløp for prosjektet
  const arbeidsforlopQuery = trpc.arbeidsforlop.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId && synlig },
  );
  const alleArbeidsforlop = (arbeidsforlopQuery.data ?? []) as ArbeidsforlopData[];

  // Auto-utled arbeidsforløp fra valgt entreprise + mal (uten eget valg)
  const matchendeArbeidsforlop = useMemo(() => {
    if (!oppretterEntrepriseId) return null;
    const treff = alleArbeidsforlop.filter(
      (af) =>
        af.enterpriseId === oppretterEntrepriseId &&
        af.templates.some((t) => t.templateId === mal.id),
    );
    // Bruk første treff — entreprisen skal være satt opp korrekt
    return treff[0] ?? null;
  }, [alleArbeidsforlop, oppretterEntrepriseId, mal.id]);

  // Svarer-entreprise utledes fra arbeidsforløpet
  const autoSvarerEntrepriseId = matchendeArbeidsforlop
    ? matchendeArbeidsforlop.responderEnterpriseId ?? matchendeArbeidsforlop.enterpriseId
    : null;
  const autoSvarerNavn = matchendeArbeidsforlop
    ? matchendeArbeidsforlop.responderEnterprise?.name ??
      entrepriser.find((e) => e.id === matchendeArbeidsforlop.enterpriseId)?.name ??
      ""
    : "";

  // Hent bygninger for prosjektet
  const bygningQuery = trpc.bygning.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId && synlig },
  );
  const bygninger = (bygningQuery.data ?? []) as BygningData[];

  // Hent tegninger — filtrert etter bygning
  const tegningQuery = trpc.tegning.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId!, buildingId: valgtBygningId ?? undefined },
    { enabled: !!valgtProsjektId && !!valgtBygningId && synlig },
  );
  const tegninger = (tegningQuery.data ?? []) as TegningData[];

  // eslint-disable-next-line
  const opprettSjekkliste = trpc.sjekkliste.opprett.useMutation({
    onSuccess: (_data: unknown) => {
      const resultat = _data as { id: string };
      nullstillSkjema();
      onOpprettet(resultat.id);
    },
    onError: (feil: { message: string }) => {
      Alert.alert("Feil", feil.message || "Kunne ikke opprette sjekkliste");
    },
  });

  // eslint-disable-next-line
  const opprettOppgave = trpc.oppgave.opprett.useMutation({
    onSuccess: (_data: unknown) => {
      const resultat = _data as { id: string };
      nullstillSkjema();
      onOpprettet(resultat.id);
    },
    onError: (feil: { message: string }) => {
      Alert.alert("Feil", feil.message || "Kunne ikke opprette oppgave");
    },
  });

  const erPending = opprettSjekkliste.isPending || opprettOppgave.isPending;

  const nullstillSkjema = useCallback(() => {
    setEmne("");
    setPrioritet("medium");
    setOppretterEntrepriseId(null);
    setValgtBygningId(null);
    setValgtTegningId(null);
    setVisOppretterListe(false);
    setVisBygningListe(false);
    setVisTegningListe(false);
  }, []);

  const håndterAvbryt = useCallback(() => {
    nullstillSkjema();
    onLukk();
  }, [nullstillSkjema, onLukk]);

  const håndterOpprett = useCallback(() => {
    if (!oppretterEntrepriseId) {
      Alert.alert("Mangler oppretter", "Velg en oppretter-entreprise");
      return;
    }
    if (!matchendeArbeidsforlop || !autoSvarerEntrepriseId) {
      Alert.alert(
        "Mangler arbeidsforløp",
        "Denne entreprisen har ikke et arbeidsforløp konfigurert for denne malen. Sett opp arbeidsforløp under Innstillinger > Field > Entrepriser.",
      );
      return;
    }

    if (kategori === "sjekkliste") {
      opprettSjekkliste.mutate({
        templateId: mal.id,
        creatorEnterpriseId: oppretterEntrepriseId,
        responderEnterpriseId: autoSvarerEntrepriseId,
        title: prosjektNavn,
        workflowId: matchendeArbeidsforlop.id,
        subject: emne.trim() || undefined,
        buildingId: valgtBygningId || undefined,
        drawingId: valgtTegningId || undefined,
      });
    } else {
      opprettOppgave.mutate({
        templateId: mal.id,
        creatorEnterpriseId: oppretterEntrepriseId,
        responderEnterpriseId: autoSvarerEntrepriseId,
        title: prosjektNavn,
        priority: prioritet,
      });
    }
  }, [
    oppretterEntrepriseId,
    matchendeArbeidsforlop,
    autoSvarerEntrepriseId,
    kategori,
    mal.id,
    prosjektNavn,
    emne,
    valgtBygningId,
    valgtTegningId,
    prioritet,
    opprettSjekkliste,
    opprettOppgave,
  ]);

  const kanOpprett = !!oppretterEntrepriseId && !!matchendeArbeidsforlop && !erPending;

  // Lukk alle åpne dropdowns
  const lukkAlleDropdowns = () => {
    setVisOppretterListe(false);
    setVisBygningListe(false);
    setVisTegningListe(false);
  };

  const valgtOppretter = entrepriser.find((e) => e.id === oppretterEntrepriseId);
  const valgtBygning = bygninger.find((b) => b.id === valgtBygningId);
  const valgtTegning = tegninger.find((t) => t.id === valgtTegningId);

  return (
    <Modal visible={synlig} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: "#ffffff" }}>
        {/* Header */}
        <View className="flex-row items-center justify-between bg-siteflow-blue px-4 py-3">
          <Pressable onPress={håndterAvbryt} hitSlop={8}>
            <Text className="text-sm font-medium text-white">Avbryt</Text>
          </Pressable>
          <Text className="text-sm font-semibold text-white">
            Ny {kategori === "sjekkliste" ? "sjekkliste" : "oppgave"}
          </Text>
          <Pressable onPress={håndterOpprett} disabled={!kanOpprett} hitSlop={8}>
            {erPending ? (
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
          {/* 1. Mal-info med prefix-badge */}
          <View className="border-b border-gray-100 bg-gray-50 px-4 py-3">
            <Text className="text-xs font-medium text-gray-500">Mal</Text>
            <View className="mt-1 flex-row items-center gap-2">
              <Text className="text-sm font-medium text-gray-900">{mal.name}</Text>
              {mal.prefix ? (
                <View className="rounded bg-blue-100 px-2 py-0.5">
                  <Text className="text-xs font-medium text-blue-700">{mal.prefix}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* 2. Prosjekt (read-only, auto fra kontekst) */}
          <View className="border-b border-gray-100 px-4 py-3">
            <Text className="text-xs font-medium text-gray-500">Prosjekt</Text>
            <Text className="mt-1 text-sm text-gray-800">
              {prosjektNavn || "Laster…"}
            </Text>
          </View>

          {/* 3. Emne (valgfritt tekstfelt) */}
          <View className="border-b border-gray-100 px-4 py-3">
            <Text className="mb-1 text-xs font-medium text-gray-500">Emne</Text>
            <TextInput
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800"
              placeholder="Beskriv emnet (valgfritt)…"
              placeholderTextColor="#9ca3af"
              value={emne}
              onChangeText={setEmne}
            />
          </View>

          {/* 4. Prioritet — kun for oppgaver */}
          {kategori === "oppgave" && (
            <View className="border-b border-gray-100 px-4 py-3">
              <Text className="mb-2 text-xs font-medium text-gray-500">Prioritet</Text>
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
          )}

          {/* 5. Oppretter-entreprise */}
          <View className="border-b border-gray-100 px-4 py-3">
            <Text className="mb-1 text-xs font-medium text-gray-500">
              Oppretter-entreprise *
            </Text>
            <Pressable
              onPress={() => {
                lukkAlleDropdowns();
                setVisOppretterListe(!visOppretterListe);
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

          {/* 6. Svarer-entreprise (read-only, auto-utledet fra arbeidsforløp) */}
          {oppretterEntrepriseId && (
            <View className="border-b border-gray-100 bg-gray-50 px-4 py-3">
              <Text className="text-xs font-medium text-gray-500">Svarer-entreprise</Text>
              {matchendeArbeidsforlop ? (
                <View className="mt-1 flex-row items-center gap-2">
                  <Text className="text-sm text-gray-800">{autoSvarerNavn}</Text>
                  {!matchendeArbeidsforlop.responderEnterpriseId && (
                    <Text className="text-xs text-gray-400">(intern flyt)</Text>
                  )}
                </View>
              ) : (
                <Text className="mt-1 text-sm text-amber-600">
                  Ingen arbeidsforløp konfigurert for denne malen
                </Text>
              )}
            </View>
          )}

          {/* 7. Lokasjon — valgfri bygning */}
          <View className="border-b border-gray-100 px-4 py-3">
            <Text className="mb-1 text-xs font-medium text-gray-500">Lokasjon</Text>
            <Pressable
              onPress={() => {
                lukkAlleDropdowns();
                setVisBygningListe(!visBygningListe);
              }}
              className="flex-row items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5"
            >
              <Text
                className={`text-sm ${valgtBygning ? "text-gray-800" : "text-gray-400"}`}
              >
                {valgtBygning?.name ?? "Velg bygning (valgfritt)…"}
              </Text>
              <ChevronDown size={16} color="#9ca3af" />
            </Pressable>
            {visBygningListe && (
              <View className="mt-1 rounded-lg border border-gray-200 bg-white">
                <Pressable
                  onPress={() => {
                    setValgtBygningId(null);
                    setValgtTegningId(null);
                    setVisBygningListe(false);
                  }}
                  className="border-b border-gray-50 px-3 py-2.5"
                >
                  <Text className="text-sm italic text-gray-400">Ingen bygning</Text>
                </Pressable>
                {bygninger.map((b) => (
                  <Pressable
                    key={b.id}
                    onPress={() => {
                      setValgtBygningId(b.id);
                      setValgtTegningId(null);
                      setVisBygningListe(false);
                    }}
                    className={`border-b border-gray-50 px-3 py-2.5 ${valgtBygningId === b.id ? "bg-blue-50" : ""}`}
                  >
                    <Text
                      className={`text-sm ${valgtBygningId === b.id ? "font-medium text-blue-700" : "text-gray-700"}`}
                    >
                      {b.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* 8. Tegning — kun når bygning er valgt */}
          {valgtBygningId && (
            <View className="border-b border-gray-100 px-4 py-3">
              <Text className="mb-1 text-xs font-medium text-gray-500">Tegning</Text>
              <Pressable
                onPress={() => {
                  lukkAlleDropdowns();
                  setVisTegningListe(!visTegningListe);
                }}
                className="flex-row items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5"
              >
                <Text
                  className={`text-sm ${valgtTegning ? "text-gray-800" : "text-gray-400"}`}
                >
                  {valgtTegning
                    ? `${valgtTegning.drawingNumber ?? ""} ${valgtTegning.name}`.trim()
                    : "Velg tegning (valgfritt)…"}
                </Text>
                <ChevronDown size={16} color="#9ca3af" />
              </Pressable>
              {visTegningListe && (
                <View className="mt-1 rounded-lg border border-gray-200 bg-white">
                  <Pressable
                    onPress={() => {
                      setValgtTegningId(null);
                      setVisTegningListe(false);
                    }}
                    className="border-b border-gray-50 px-3 py-2.5"
                  >
                    <Text className="text-sm italic text-gray-400">Ingen tegning</Text>
                  </Pressable>
                  {tegninger.map((t) => (
                    <Pressable
                      key={t.id}
                      onPress={() => {
                        setValgtTegningId(t.id);
                        setVisTegningListe(false);
                      }}
                      className={`border-b border-gray-50 px-3 py-2.5 ${valgtTegningId === t.id ? "bg-blue-50" : ""}`}
                    >
                      <Text
                        className={`text-sm ${valgtTegningId === t.id ? "font-medium text-blue-700" : "text-gray-700"}`}
                      >
                        {`${t.drawingNumber ?? ""} ${t.name}`.trim()}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
