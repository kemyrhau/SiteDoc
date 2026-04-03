import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native";
import { ChevronDown } from "lucide-react-native";
import { trpc } from "../lib/trpc";
import { useProsjekt } from "../kontekst/ProsjektKontekst";

// Persistering av sist brukt bygning/tegning per prosjekt
const BYGNING_KEY_PREFIX = "sitedoc_sist_bygning_";
const TEGNING_KEY_PREFIX = "sitedoc_sist_tegning_";

async function lagreVerdi(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(key, value);
  } else {
    const SecureStore = await import("expo-secure-store");
    await SecureStore.setItemAsync(key, value);
  }
}

async function hentVerdi(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem(key);
  }
  const SecureStore = await import("expo-secure-store");
  return SecureStore.getItemAsync(key);
}

async function slettVerdi(key: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.removeItem(key);
  } else {
    const SecureStore = await import("expo-secure-store");
    await SecureStore.deleteItemAsync(key);
  }
}

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
  subjects?: string[];
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
  onModalLukket?: () => void;
  // Props for oppgave fra sjekkliste
  sjekklisteId?: string;
  sjekklisteFeltId?: string;
  sjekklisteNummer?: string;
  feltLabel?: string;
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
  onModalLukket,
  sjekklisteId,
  sjekklisteFeltId,
  sjekklisteNummer,
  feltLabel,
}: OpprettDokumentModalProps) {
  const erOppgave = kategori === "oppgave";
  const erFraSjekkliste = !!sjekklisteId && !!sjekklisteFeltId;
  const { valgtProsjektId } = useProsjekt();

  const [emne, setEmne] = useState("");
  const [prioritet, setPrioritet] = useState<Prioritet>("medium");
  const [oppretterEntrepriseId, setOppretterEntrepriseId] = useState<string | null>(null);
  const [valgtBygningId, setValgtBygningId] = useState<string | null>(null);
  const [valgtTegningId, setValgtTegningId] = useState<string | null>(null);
  const [visOppretterListe, setVisOppretterListe] = useState(false);
  const [visBygningListe, setVisBygningListe] = useState(false);
  const [visTegningListe, setVisTegningListe] = useState(false);
  const [visEmneListe, setVisEmneListe] = useState(false);

  // Last sist brukte bygning/tegning fra lagring ved åpning
  const harLastetLagret = useRef(false);
  useEffect(() => {
    if (!synlig || !valgtProsjektId || harLastetLagret.current) return;
    harLastetLagret.current = true;

    (async () => {
      const lagretBygning = await hentVerdi(`${BYGNING_KEY_PREFIX}${valgtProsjektId}`);
      if (lagretBygning) {
        setValgtBygningId(lagretBygning);
        const lagretTegning = await hentVerdi(`${TEGNING_KEY_PREFIX}${valgtProsjektId}`);
        if (lagretTegning) setValgtTegningId(lagretTegning);
      }
    })();
  }, [synlig, valgtProsjektId]);

  // Nullstill ref når modal lukkes
  useEffect(() => {
    if (!synlig) harLastetLagret.current = false;
  }, [synlig]);

  // Forhåndsdefinerte emner fra malen
  const malSubjects = Array.isArray(mal.subjects)
    ? mal.subjects.filter((s) => s.trim() !== "")
    : [];
  const harSubjects = malSubjects.length > 0;

  // Hent prosjektnavn for auto-tittel
  const prosjektQuery = trpc.prosjekt.hentMine.useQuery(undefined, {
    enabled: synlig,
  });
  const prosjekter = prosjektQuery.data ?? [];
  const valgtProsjekt = prosjekter.find((p: { id: string }) => p.id === valgtProsjektId);
  const prosjektNavn = valgtProsjekt?.name ?? "";

  // Hent brukerens entrepriser (filtrert til mine)
  const mineEntrepriserQuery = trpc.medlem.hentMineEntrepriser.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId && synlig },
  );
  const mineEntrepriser = (mineEntrepriserQuery.data ?? []) as EntrepriseData[];

  // Fallback: hent alle entrepriser for svarer-visning
  const entrepriseQuery = trpc.entreprise.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId && synlig },
  );
  const entrepriser = (entrepriseQuery.data ?? []) as EntrepriseData[];

  // Auto-velg hvis brukeren har kun én entreprise
  useEffect(() => {
    if (mineEntrepriser.length === 1 && !oppretterEntrepriseId) {
      setOppretterEntrepriseId(mineEntrepriser[0].id);
    }
  }, [mineEntrepriser, oppretterEntrepriseId]);

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
    // Beholder valgtBygningId og valgtTegningId — de lastes fra lagring neste gang
    setVisOppretterListe(false);
    setVisBygningListe(false);
    setVisTegningListe(false);
    setVisEmneListe(false);
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
        "Denne entreprisen har ikke et arbeidsforløp konfigurert for denne malen. Sett opp arbeidsforløp under Innstillinger > Feltarbeid > Entrepriser.",
      );
      return;
    }

    if (kategori === "sjekkliste") {
      opprettSjekkliste.mutate({
        templateId: mal.id,
        creatorEnterpriseId: oppretterEntrepriseId,
        responderEnterpriseId: autoSvarerEntrepriseId,
        workflowId: matchendeArbeidsforlop.id,
        subject: emne.trim() || undefined,
      });
    } else {
      // Oppgave-tittel: fra sjekkliste eller prosjektnavn
      const oppgaveTittel = erFraSjekkliste && sjekklisteNummer && feltLabel
        ? `Oppgave fra ${sjekklisteNummer}: ${feltLabel}`
        : prosjektNavn;

      opprettOppgave.mutate({
        templateId: mal.id,
        creatorEnterpriseId: oppretterEntrepriseId,
        responderEnterpriseId: autoSvarerEntrepriseId,
        title: oppgaveTittel,
        priority: prioritet,
        workflowId: matchendeArbeidsforlop.id,
        checklistId: sjekklisteId || undefined,
        checklistFieldId: sjekklisteFeltId || undefined,
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
    erFraSjekkliste,
    sjekklisteId,
    sjekklisteFeltId,
    sjekklisteNummer,
    feltLabel,
  ]);

  const kanOpprett = !!oppretterEntrepriseId && !!matchendeArbeidsforlop && !erPending;

  // Auto-opprett deaktivert — modal-animasjon + navigering kolliderer på iOS
  // Brukeren trykker "Opprett" manuelt

  // Lukk alle åpne dropdowns
  const lukkAlleDropdowns = () => {
    setVisOppretterListe(false);
    setVisBygningListe(false);
    setVisTegningListe(false);
    setVisEmneListe(false);
  };

  const valgtOppretter = mineEntrepriser.find((e) => e.id === oppretterEntrepriseId);
  const valgtBygning = bygninger.find((b) => b.id === valgtBygningId);
  const valgtTegning = tegninger.find((t) => t.id === valgtTegningId);

  return (
    <Modal visible={synlig} animationType="slide" onRequestClose={onLukk}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#ffffff" }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
        {/* Header */}
        <View className="flex-row items-center justify-between bg-sitedoc-blue px-4 py-3">
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

          {/* 3. Emne — dropdown med forhåndsdefinerte tekster, eller fritekst som fallback */}
          {!erOppgave && (
            <View className="border-b border-gray-100 px-4 py-3">
              <Text className="mb-1 text-xs font-medium text-gray-500">Emne</Text>
              {harSubjects ? (
                <>
                  <Pressable
                    onPress={() => {
                      lukkAlleDropdowns();
                      setVisEmneListe(!visEmneListe);
                    }}
                    className="flex-row items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5"
                  >
                    <Text
                      className={`text-sm ${emne ? "text-gray-800" : "text-gray-400"}`}
                    >
                      {emne || "Velg emne…"}
                    </Text>
                    <ChevronDown size={16} color="#9ca3af" />
                  </Pressable>
                  {visEmneListe && (
                    <View className="mt-1 rounded-lg border border-gray-200 bg-white">
                      <Pressable
                        onPress={() => {
                          setEmne("");
                          setVisEmneListe(false);
                        }}
                        className="border-b border-gray-50 px-3 py-2.5"
                      >
                        <Text className="text-sm italic text-gray-400">Ingen emne</Text>
                      </Pressable>
                      {malSubjects.map((s) => (
                        <Pressable
                          key={s}
                          onPress={() => {
                            setEmne(s);
                            setVisEmneListe(false);
                          }}
                          className={`border-b border-gray-50 px-3 py-2.5 ${emne === s ? "bg-blue-50" : ""}`}
                        >
                          <Text
                            className={`text-sm ${emne === s ? "font-medium text-blue-700" : "text-gray-700"}`}
                          >
                            {s}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </>
              ) : (
                <TextInput
                  className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800"
                  placeholder="Beskriv emnet (valgfritt)…"
                  placeholderTextColor="#9ca3af"
                  value={emne}
                  onChangeText={setEmne}
                />
              )}
            </View>
          )}

          {/* Sjekkliste-referanse (kun for oppgave fra sjekkliste) */}
          {erOppgave && erFraSjekkliste && (
            <View className="border-b border-gray-100 bg-blue-50 px-4 py-3">
              <Text className="text-xs font-medium text-blue-600">Fra sjekkliste</Text>
              <Text className="mt-0.5 text-sm text-blue-800">
                {sjekklisteNummer ? `${sjekklisteNummer}: ` : ""}{feltLabel ?? ""}
              </Text>
            </View>
          )}

          {/* 4. Prioritet — skjult i forenklet oppgaveflyt (redigeres i detaljskjerm) */}

          {/* 5. Oppretter-entreprise (kun brukerens entrepriser) */}
          <View className="border-b border-gray-100 px-4 py-3">
            <Text className="mb-1 text-xs font-medium text-gray-500">
              Oppretter-entreprise *
            </Text>
            {mineEntrepriser.length === 1 ? (
              /* Auto-valgt — vises som read-only */
              <View className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                <Text className="text-sm text-gray-800">{mineEntrepriser[0].name}</Text>
              </View>
            ) : (
              <>
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
                    {mineEntrepriser.map((e) => (
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
              </>
            )}
          </View>

          {/* 6. Svarer-entreprise (read-only, auto-utledet fra arbeidsforløp) */}
          {oppretterEntrepriseId && (
            <View className="border-b border-gray-100 bg-gray-50 px-4 py-3">
              <Text className="text-xs font-medium text-gray-500">Svarer-entreprise</Text>
              {arbeidsforlopQuery.isLoading ? (
                <View className="mt-1 flex-row items-center gap-2">
                  <ActivityIndicator size="small" color="#1e40af" />
                  <Text className="text-sm text-gray-500">Henter arbeidsforløp…</Text>
                </View>
              ) : matchendeArbeidsforlop ? (
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

          {/* Lokasjon settes fra tegning (ved klikk) eller etterpå — ikke i opprettelsesmodal */}
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
