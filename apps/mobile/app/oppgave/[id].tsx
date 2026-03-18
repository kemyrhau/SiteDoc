import { useCallback, useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView as RNSafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Save,
  Check,
  AlertTriangle,
  Clock,
  CloudOff,
  Cloud,
  ClipboardCheck,
  MapPin,
  Trash2,
  ChevronDown,
  MessageCircle,
  Send,
} from "lucide-react-native";
import { harBetingelse, harForelderObjekt } from "@sitedoc/shared";
import { hentStatusHandlinger } from "@sitedoc/shared";
import type { StatusHandling } from "@sitedoc/shared";
import { useOppgaveSkjema } from "../../src/hooks/useOppgaveSkjema";
import { useOpplastingsKo } from "../../src/providers/OpplastingsKoProvider";
import { useAuth } from "../../src/providers/AuthProvider";
import { StatusMerkelapp } from "../../src/components/StatusMerkelapp";
import { RapportObjektRenderer, DISPLAY_TYPER } from "../../src/components/rapportobjekter";
import { FeltWrapper } from "../../src/components/rapportobjekter/FeltWrapper";
import { trpc } from "../../src/lib/trpc";
import { useProsjekt } from "../../src/kontekst/ProsjektKontekst";
import { hentDatabase } from "../../src/db/database";
import { oppgaveFeltdata, opplastingsKo } from "../../src/db/schema";
import { eq } from "drizzle-orm";

const PRIORITETER = [
  { verdi: "low", label: "Lav", farge: "bg-gray-200 text-gray-700" },
  { verdi: "medium", label: "Medium", farge: "bg-blue-100 text-blue-700" },
  { verdi: "high", label: "Høy", farge: "bg-orange-100 text-orange-700" },
  { verdi: "critical", label: "Kritisk", farge: "bg-red-100 text-red-700" },
] as const;

interface Transfer {
  id: string;
  fromStatus: string;
  toStatus: string;
  comment: string | null;
  createdAt: Date | string;
  sender?: { name: string | null } | null;
}

function formaterHistorikkDato(dato: Date | string): string {
  const d = new Date(dato);
  return d.toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formaterNummer(
  prefix: string | null | undefined,
  nummer: number | null | undefined,
): string | null {
  if (!prefix || nummer == null) return null;
  return `${prefix}${nummer}`;
}

export default function OppgaveDetalj() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { bruker } = useAuth();
  const { valgtProsjektId } = useProsjekt();
  const utils = trpc.useUtils();

  // State for inline redigering av tittel og beskrivelse
  const [visTittelModal, settVisTittelModal] = useState(false);
  const [visBeskrivelseModal, settVisBeskrivelseModal] = useState(false);
  const [visDialogModal, settVisDialogModal] = useState(false);
  const [tittelUtkast, settTittelUtkast] = useState("");
  const [beskrivelseUtkast, settBeskrivelseUtkast] = useState("");
  const [dialogTekst, settDialogTekst] = useState("");
  const [visEntrepriseListe, settVisEntrepriseListe] = useState<"oppretter" | "svarer" | null>(null);

  const { ventende } = useOpplastingsKo();

  // Hent overføringer for historikk
  const detaljQuery = trpc.oppgave.hentMedId.useQuery(
    { id: id! },
    { enabled: !!id },
  );
  // eslint-disable-next-line
  const oppgaveDetalj = detaljQuery.data as {
    transfers?: Transfer[];
    drawing?: { id: string; name: string; drawingNumber?: string | null } | null;
  } | undefined;
  const overforinger = oppgaveDetalj?.transfers;

  // Hent entrepriser for redigering
  const { data: mineEntrepriser } = trpc.medlem.hentMineEntrepriser.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId },
  );
  const { data: alleEntrepriser } = trpc.entreprise.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId },
  );

  const endreStatusMutasjon = trpc.oppgave.endreStatus.useMutation({
    onSuccess: () => {
      utils.oppgave.hentMedId.invalidate({ id: id! });
      utils.oppgave.hentForProsjekt.invalidate();
    },
  });

  const oppdaterMutasjon = trpc.oppgave.oppdater.useMutation({
    onSuccess: () => {
      utils.oppgave.hentMedId.invalidate({ id: id! });
    },
  });

  const slettMutasjon = trpc.oppgave.slett.useMutation({
    onSuccess: () => {
      // Rydd opp lokal SQLite-data
      const db = hentDatabase();
      if (db && id) {
        try {
          db.delete(oppgaveFeltdata).where(eq(oppgaveFeltdata.oppgaveId, id)).run();
          db.delete(opplastingsKo).where(eq(opplastingsKo.oppgaveId, id)).run();
        } catch {
          // Ignorer SQLite-feil ved opprydding
        }
      }
      utils.oppgave.hentForProsjekt.invalidate();
      utils.oppgave.hentForTegning.invalidate();
      router.back();
    },
    onError: (feil: { message?: string }) => {
      Alert.alert("Kunne ikke slette", feil.message || "Ukjent feil ved sletting");
    },
  });

  // Kommentarer/dialog
  const kommentarQuery = trpc.oppgave.hentKommentarer.useQuery(
    { taskId: id! },
    { enabled: !!id },
  );
  const kommentarer = (kommentarQuery.data ?? []) as Array<{
    id: string;
    content: string;
    createdAt: string;
    user: { id: string; name: string | null; email: string };
  }>;

  const leggTilKommentarMutasjon = trpc.oppgave.leggTilKommentar.useMutation({
    onSuccess: () => {
      utils.oppgave.hentKommentarer.invalidate({ taskId: id! });
      settDialogTekst("");
      settVisDialogModal(false);
    },
  });

  const håndterSendKommentar = useCallback(() => {
    if (!dialogTekst.trim() || !id) return;
    leggTilKommentarMutasjon.mutate({ taskId: id, content: dialogTekst.trim() });
  }, [dialogTekst, id, leggTilKommentarMutasjon]);

  const håndterSlett = useCallback(() => {
    Alert.alert(
      "Slett oppgave",
      "Er du sikker på at du vil slette denne oppgaven? Dette kan ikke angres.",
      [
        { text: "Avbryt", style: "cancel" },
        {
          text: "Slett",
          style: "destructive",
          onPress: () => slettMutasjon.mutate({ id: id! }),
        },
      ],
    );
  }, [id, slettMutasjon]);

  const håndterStatusEndring = useCallback(
    (handling: StatusHandling) => {
      if (!bruker?.id) return;

      const bekreftTekst = handling.nyStatus === "cancelled" ? "Ja, avbryt oppgaven" : handling.tekst;
      const erDestruktiv = handling.nyStatus === "rejected" || handling.nyStatus === "cancelled";

      Alert.alert(
        "Bekreft statusendring",
        `Er du sikker på at du vil endre status til "${handling.tekst.toLowerCase()}"?`,
        [
          { text: "Ikke nå", style: "cancel" },
          {
            text: bekreftTekst,
            style: erDestruktiv ? "destructive" : "default",
            onPress: async () => {
              try {
                await endreStatusMutasjon.mutateAsync({
                  id: id!,
                  nyStatus: handling.nyStatus,
                  senderId: bruker.id,
                });
              } catch {
                Alert.alert("Feil", "Kunne ikke endre status. Prøv igjen.");
              }
            },
          },
        ],
      );
    },
    [bruker?.id, id, endreStatusMutasjon],
  );

  const {
    oppgave,
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
    lagreStatus,
    synkStatus,
  } = useOppgaveSkjema(id!);

  const håndterTilbake = useCallback(async () => {
    if (harEndringer) {
      await lagre();
    }
    router.back();
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

  const endrePrioritet = useCallback(
    (nyPrioritet: string) => {
      if (!oppgave) return;
      oppdaterMutasjon.mutate({ id: oppgave.id, priority: nyPrioritet as "low" | "medium" | "high" | "critical" });
    },
    [oppgave, oppdaterMutasjon],
  );

  const lagreTittel = useCallback(() => {
    if (!oppgave || !tittelUtkast.trim()) return;
    oppdaterMutasjon.mutate({ id: oppgave.id, title: tittelUtkast.trim() });
    settVisTittelModal(false);
  }, [oppgave, tittelUtkast, oppdaterMutasjon]);

  const lagreBeskrivelse = useCallback(() => {
    if (!oppgave) return;
    oppdaterMutasjon.mutate({ id: oppgave.id, description: beskrivelseUtkast.trim() || undefined });
    settVisBeskrivelseModal(false);
  }, [oppgave, beskrivelseUtkast, oppdaterMutasjon]);

  // Beregn objekter og repeater-logikk FØR tidlige returns (hooks må alltid kjøres)
  const objekter = useMemo(() =>
    (oppgave?.template?.objects ?? []).slice().sort((a, b) => {
      const zoneA = (a.config as Record<string, unknown>)?.zone === "topptekst" ? 0 : 1;
      const zoneB = (b.config as Record<string, unknown>)?.zone === "topptekst" ? 0 : 1;
      if (zoneA !== zoneB) return zoneA - zoneB;
      return a.sortOrder - b.sortOrder;
    }),
  [oppgave]);
  const repeaterIder = useMemo(() => new Set(
    objekter.filter((o) => o.type === "repeater").map((o) => o.id),
  ), [objekter]);
  const repeaterBarnIder = useMemo(() => new Set(
    objekter.filter((o) => o.parentId && repeaterIder.has(o.parentId)).map((o) => o.id),
  ), [objekter, repeaterIder]);
  const barneObjekterMap = useMemo(() => {
    const m = new Map<string, typeof objekter>();
    for (const obj of objekter) {
      if (obj.parentId && repeaterIder.has(obj.parentId)) {
        const liste = m.get(obj.parentId) ?? [];
        liste.push(obj);
        m.set(obj.parentId, liste);
      }
    }
    return m;
  }, [objekter, repeaterIder]);

  if (erLaster) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#1e40af" />
        <Text className="mt-3 text-sm text-gray-500">Henter oppgave...</Text>
      </SafeAreaView>
    );
  }

  if (!oppgave) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-gray-50">
        <Text className="text-base text-gray-500">Oppgaven ble ikke funnet</Text>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text className="text-blue-600">Gå tilbake</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const nummer = formaterNummer(oppgave.template?.prefix, oppgave.number);
  const leseModus = !erRedigerbar;

  // Sjekkliste-referanse
  const sjekklisteNummer = oppgave.checklist
    ? formaterNummer(oppgave.checklist.template?.prefix, oppgave.checklist.number)
    : null;

  return (
    <SafeAreaView className="flex-1 bg-gray-100" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between bg-sitedoc-blue px-4 py-3">
        <Pressable onPress={håndterTilbake} hitSlop={12} className="flex-row items-center gap-2">
          <ArrowLeft size={22} color="#ffffff" />
        </Pressable>
        <Text className="flex-1 px-3 text-center text-base font-semibold text-white" numberOfLines={1}>
          {nummer ? `${nummer} ` : ""}Oppgave
        </Text>
        {erRedigerbar ? (
          <View className="flex-row items-center gap-2">
            {/* Opplastingskø-fremdrift */}
            {ventende > 0 && (
              <View className="flex-row items-center gap-1">
                <ActivityIndicator size="small" color="#fbbf24" />
                <Text className="text-[10px] text-yellow-200">{ventende}</Text>
              </View>
            )}
            {/* Synkroniseringsstatus */}
            {synkStatus === "synkroniserer" && (
              <ActivityIndicator size="small" color="#93c5fd" />
            )}
            {synkStatus === "lokalt_lagret" && ventende === 0 && (
              <CloudOff size={16} color="#fbbf24" />
            )}
            {synkStatus === "synkronisert" && ventende === 0 && lagreStatus !== "lagret" && lagreStatus !== "lagrer" && (
              <Cloud size={16} color="#86efac" />
            )}
            {/* Lagrestatus */}
            {lagreStatus === "lagrer" && (
              <ActivityIndicator size="small" color="#93c5fd" />
            )}
            {lagreStatus === "lagret" && (
              <Check size={18} color="#86efac" />
            )}
            {lagreStatus === "feil" && (
              <AlertTriangle size={18} color="#fca5a5" />
            )}
            <Pressable onPress={håndterLagre} hitSlop={12} disabled={erLagrer}>
              <Save size={22} color={erLagrer ? "#93c5fd" : "#ffffff"} />
            </Pressable>
          </View>
        ) : (
          <View style={{ width: 22 }} />
        )}
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >

      {/* Metadata-bar */}
      <View className="flex-row items-center justify-between border-b border-gray-200 bg-white px-4 py-2">
        <View className="flex-row items-center gap-2">
          {oppgave.template?.prefix && (
            <Text className="text-xs font-medium text-gray-500">
              {oppgave.template.prefix}
            </Text>
          )}
          <Text className="text-sm text-gray-700" numberOfLines={1}>
            {oppgave.template?.name}
          </Text>
        </View>
        <StatusMerkelapp status={oppgave.status} />
      </View>

      {/* Entrepriser */}
      {oppgave.status === "draft" ? (
        <View className="border-b border-gray-200 bg-white px-4 py-2">
          <View className="flex-row items-center gap-2">
            {/* Oppretter */}
            <Pressable
              className="flex-1"
              onPress={() => settVisEntrepriseListe(visEntrepriseListe === "oppretter" ? null : "oppretter")}
            >
              <Text className="text-[10px] text-gray-400">Fra</Text>
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-medium text-gray-700">
                  {oppgave.creatorEnterprise?.name ?? "Velg…"}
                </Text>
                <ChevronDown size={12} color="#9ca3af" />
              </View>
            </Pressable>
            <Text className="text-xs text-gray-300">→</Text>
            {/* Svarer */}
            <Pressable
              className="flex-1"
              onPress={() => settVisEntrepriseListe(visEntrepriseListe === "svarer" ? null : "svarer")}
            >
              <Text className="text-right text-[10px] text-gray-400">Til</Text>
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-medium text-gray-700">
                  {oppgave.responderEnterprise?.name ?? "Velg…"}
                </Text>
                <ChevronDown size={12} color="#9ca3af" />
              </View>
            </Pressable>
          </View>
          {/* Dropdown for oppretter */}
          {visEntrepriseListe === "oppretter" && (
            <View className="mt-1 rounded-lg border border-gray-200 bg-white">
              {(mineEntrepriser ?? []).map((e: { id: string; name: string }) => (
                <Pressable
                  key={e.id}
                  onPress={() => {
                    oppdaterMutasjon.mutate({ id: id!, creatorEnterpriseId: e.id });
                    settVisEntrepriseListe(null);
                  }}
                  className={`border-b border-gray-50 px-3 py-2 ${e.id === oppgave.creatorEnterprise?.id ? "bg-blue-50" : ""}`}
                >
                  <Text className={`text-xs ${e.id === oppgave.creatorEnterprise?.id ? "font-medium text-blue-700" : "text-gray-700"}`}>
                    {e.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          {/* Dropdown for svarer */}
          {visEntrepriseListe === "svarer" && (
            <View className="mt-1 rounded-lg border border-gray-200 bg-white">
              {(alleEntrepriser ?? []).map((e: { id: string; name: string }) => (
                <Pressable
                  key={e.id}
                  onPress={() => {
                    oppdaterMutasjon.mutate({ id: id!, responderEnterpriseId: e.id });
                    settVisEntrepriseListe(null);
                  }}
                  className={`border-b border-gray-50 px-3 py-2 ${e.id === oppgave.responderEnterprise?.id ? "bg-blue-50" : ""}`}
                >
                  <Text className={`text-xs ${e.id === oppgave.responderEnterprise?.id ? "font-medium text-blue-700" : "text-gray-700"}`}>
                    {e.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      ) : (
        <View className="flex-row border-b border-gray-200 bg-white px-4 py-1.5">
          {oppgave.creatorEnterprise && (
            <Text className="flex-1 text-xs text-gray-500">
              Oppretter: {oppgave.creatorEnterprise.name}
            </Text>
          )}
          {oppgave.responderEnterprise && (
            <Text className="flex-1 text-right text-xs text-gray-500">
              Svarer: {oppgave.responderEnterprise.name}
            </Text>
          )}
        </View>
      )}

      {/* Innhold */}
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-2 p-3 pb-8"
        keyboardShouldPersistTaps="handled"
      >
        {/* Tittel */}
        <View className="rounded-lg bg-white p-4">
          <Text className="mb-1 text-xs font-medium text-gray-500">Tittel</Text>
          <Pressable
            onPress={() => {
              if (leseModus) return;
              settTittelUtkast(oppgave.title);
              settVisTittelModal(true);
            }}
          >
            <Text className="text-base font-semibold text-gray-900">{oppgave.title}</Text>
          </Pressable>
        </View>

        {/* Prioritet */}
        <View className="rounded-lg bg-white p-4">
          <Text className="mb-2 text-xs font-medium text-gray-500">Prioritet</Text>
          <View className="flex-row gap-2">
            {PRIORITETER.map((p) => {
              const erValgt = oppgave.priority === p.verdi;
              return (
                <Pressable
                  key={p.verdi}
                  onPress={() => !leseModus && endrePrioritet(p.verdi)}
                  className={`rounded-full px-3 py-1.5 ${erValgt ? p.farge : "bg-gray-100"}`}
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

        {/* Beskrivelse */}
        <View className="rounded-lg bg-white p-4">
          <Text className="mb-1 text-xs font-medium text-gray-500">Beskrivelse</Text>
          <Pressable
            onPress={() => {
              if (leseModus) return;
              settBeskrivelseUtkast(oppgave.description ?? "");
              settVisBeskrivelseModal(true);
            }}
          >
            <Text className={`text-sm ${oppgave.description ? "text-gray-800" : "text-gray-400 italic"}`}>
              {oppgave.description || "Trykk for å legge til beskrivelse…"}
            </Text>
          </Pressable>
        </View>

        {/* Sjekkliste-kobling */}
        {oppgave.checklist && (
          <Pressable
            onPress={() => router.push(`/sjekkliste/${oppgave.checklist!.id}`)}
            className="flex-row items-center gap-3 rounded-lg bg-blue-50 p-4"
          >
            <ClipboardCheck size={18} color="#2563eb" />
            <View className="flex-1">
              <Text className="text-xs font-medium text-blue-600">Fra sjekkliste</Text>
              <Text className="text-sm text-blue-800">
                {sjekklisteNummer ? `${sjekklisteNummer} ` : ""}{oppgave.checklist.title}
              </Text>
            </View>
          </Pressable>
        )}

        {/* Tegning-kobling */}
        {oppgave.drawing && (
          <View className="flex-row items-center gap-3 rounded-lg bg-purple-50 p-4">
            <MapPin size={18} color="#7c3aed" />
            <View className="flex-1">
              <Text className="text-xs font-medium text-purple-600">Fra tegning</Text>
              <Text className="text-sm text-purple-800">
                {oppgave.drawing.drawingNumber ? `${oppgave.drawing.drawingNumber} ` : ""}{oppgave.drawing.name}
              </Text>
            </View>
          </View>
        )}

        {/* Malobjekter */}
        {objekter.map((objekt) => {
          // Skip barn av repeatere — rendres inne i RepeaterObjekt
          if (repeaterBarnIder.has(objekt.id)) return null;
          // Sjekk synlighet (betinget felt)
          if (!erSynlig(objekt)) return null;

          const erDisplay = DISPLAY_TYPER.has(objekt.type);
          // Bruk parentId fra DB (ny) med fallback til config (gammel)
          const erBetinget = harForelderObjekt(objekt) || harBetingelse(objekt.config);

          // Beregn nesting-nivå for gradert innrykk
          const hentNestingNivå = (obj: typeof objekt): number => {
            const pid = obj.parentId ?? (obj.config.conditionParentId as string | undefined);
            if (!pid) return 0;
            const forelder = objekter.find((o) => o.id === pid);
            if (!forelder) return 0;
            return 1 + hentNestingNivå(forelder);
          };
          const nestingNivå = hentNestingNivå(objekt);

          // Display-typer (heading, subtitle) rendres uten wrapper
          if (erDisplay) {
            return (
              <View key={objekt.id} className={erBetinget ? "ml-4 pl-3" : ""}>
                <RapportObjektRenderer
                  objekt={objekt}
                  verdi={null}
                  onEndreVerdi={() => {}}
                  leseModus={leseModus}
                  prosjektId={valgtProsjektId ?? undefined}
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
              oppgaveIdForKo={oppgave.id}
              nestingNivå={nestingNivå}
              valideringsfeil={valideringsfeil[objekt.id]}
            >
              <RapportObjektRenderer
                objekt={objekt}
                verdi={feltVerdi.verdi}
                onEndreVerdi={(v) => settVerdi(objekt.id, v)}
                leseModus={leseModus}
                barneObjekter={barneObjekterMap.get(objekt.id)}
                oppgaveIdForKo={oppgave.id}
              />
            </FeltWrapper>
          );
        })}

        {/* Dialog */}
        <View className="mt-4">
          <View className="flex-row items-center justify-between px-1 pb-2">
            <View className="flex-row items-center gap-2">
              <MessageCircle size={16} color="#6b7280" />
              <Text className="text-sm font-semibold text-gray-700">
                Dialog {kommentarer.length > 0 ? `(${kommentarer.length})` : ""}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                settDialogTekst("");
                settVisDialogModal(true);
              }}
              className="flex-row items-center gap-1 rounded-full bg-blue-50 px-3 py-1"
            >
              <Send size={12} color="#2563eb" />
              <Text className="text-xs font-medium text-blue-600">Ny</Text>
            </Pressable>
          </View>
          {kommentarer.length > 0 ? (
            <View className="rounded-lg bg-white">
              {kommentarer.map((k, i) => (
                <View
                  key={k.id}
                  className={`px-3 py-2.5 ${i > 0 ? "border-t border-gray-100" : ""}`}
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs font-medium text-gray-700">
                      {k.user.name ?? k.user.email}
                    </Text>
                    <Text className="text-xs text-gray-400">
                      {new Date(k.createdAt).toLocaleString("nb-NO", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                  <Text className="mt-1 text-sm text-gray-800">{k.content}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View className="rounded-lg bg-white px-3 py-4">
              <Text className="text-center text-xs text-gray-400">Ingen kommentarer ennå</Text>
            </View>
          )}
        </View>

        {/* Historikk */}
        {overforinger && overforinger.length > 0 && (
          <View className="mt-4">
            <View className="flex-row items-center gap-2 px-1 pb-2">
              <Clock size={16} color="#6b7280" />
              <Text className="text-sm font-semibold text-gray-700">Historikk</Text>
            </View>
            <View className="rounded-lg bg-white">
              {overforinger.map((t, i) => (
                <View
                  key={t.id}
                  className={`flex-row items-center gap-2 px-3 py-2.5 ${i > 0 ? "border-t border-gray-100" : ""}`}
                >
                  <View className="flex-1">
                    <View className="flex-row items-center gap-1.5">
                      <StatusMerkelapp status={t.fromStatus} />
                      <Text className="text-xs text-gray-400">→</Text>
                      <StatusMerkelapp status={t.toStatus} />
                    </View>
                    {t.sender?.name && (
                      <Text className="mt-0.5 text-xs text-gray-500">{t.sender.name}</Text>
                    )}
                    {t.comment && (
                      <Text className="mt-0.5 text-xs text-gray-600">{t.comment}</Text>
                    )}
                  </View>
                  <Text className="text-xs text-gray-400">
                    {formaterHistorikkDato(t.createdAt)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Statusknapper + lagre-knapp i bunn */}
      <View className="border-t border-gray-200 bg-white px-4 py-3">
        {/* Statushandlinger */}
        {oppgave && (() => {
          const handlinger = hentStatusHandlinger(oppgave.status);
          if (handlinger.length === 0) return null;
          return (
            <View className={`mb-2 ${handlinger.length > 1 ? "flex-row gap-2" : ""}`}>
              {handlinger.map((handling) => (
                <Pressable
                  key={handling.nyStatus}
                  onPress={() => håndterStatusEndring(handling)}
                  disabled={endreStatusMutasjon.isPending}
                  className={`items-center rounded-lg py-3 ${handlinger.length > 1 ? "flex-1" : ""} ${endreStatusMutasjon.isPending ? handling.aktivFarge : handling.farge}`}
                >
                  {endreStatusMutasjon.isPending ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text className="font-medium text-white">{handling.tekst}</Text>
                  )}
                </Pressable>
              ))}
            </View>
          );
        })()}

        {/* Lagre-knapp */}
        {erRedigerbar && (
          <Pressable
            onPress={håndterLagre}
            disabled={erLagrer}
            className={`items-center rounded-lg py-3 ${erLagrer ? "bg-blue-400" : "bg-blue-600"}`}
          >
            <Text className="font-medium text-white">
              {erLagrer ? "Lagrer..." : "Lagre utfylling"}
            </Text>
          </Pressable>
        )}

        {/* Slett-knapp (kun utkast) */}
        {oppgave?.status === "draft" && (
          <Pressable
            onPress={håndterSlett}
            disabled={slettMutasjon.isPending}
            className="mt-2 flex-row items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 py-3"
          >
            <Trash2 size={16} color="#dc2626" />
            <Text className="font-medium text-red-600">
              {slettMutasjon.isPending ? "Sletter..." : "Slett oppgave"}
            </Text>
          </Pressable>
        )}
      </View>

      </KeyboardAvoidingView>

      {/* Tittel-redigeringsmodal */}
      <Modal visible={visTittelModal} animationType="slide" onRequestClose={() => settVisTittelModal(false)}>
        <RNSafeAreaView className="flex-1 bg-white">
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            className="flex-1"
          >
            <View className="flex-row items-center justify-between border-b border-gray-200 bg-[#1e40af] px-4 py-3">
              <Text className="flex-1 text-base font-semibold text-white">Rediger tittel</Text>
              <Pressable
                onPress={lagreTittel}
                className="ml-3 rounded-lg bg-white/20 px-4 py-1.5"
              >
                <Text className="text-sm font-semibold text-white">Ferdig</Text>
              </Pressable>
            </View>
            <TextInput
              value={tittelUtkast}
              onChangeText={settTittelUtkast}
              placeholder="Tittel..."
              autoFocus
              className="flex-1 px-4 py-3 text-base text-gray-900"
            />
          </KeyboardAvoidingView>
        </RNSafeAreaView>
      </Modal>

      {/* Beskrivelse-redigeringsmodal */}
      <Modal visible={visBeskrivelseModal} animationType="slide" onRequestClose={() => settVisBeskrivelseModal(false)}>
        <RNSafeAreaView className="flex-1 bg-white">
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            className="flex-1"
          >
            <View className="flex-row items-center justify-between border-b border-gray-200 bg-[#1e40af] px-4 py-3">
              <Text className="flex-1 text-base font-semibold text-white">Beskrivelse</Text>
              <Pressable
                onPress={lagreBeskrivelse}
                className="ml-3 rounded-lg bg-white/20 px-4 py-1.5"
              >
                <Text className="text-sm font-semibold text-white">Ferdig</Text>
              </Pressable>
            </View>
            <TextInput
              value={beskrivelseUtkast}
              onChangeText={settBeskrivelseUtkast}
              placeholder="Skriv beskrivelse..."
              multiline
              autoFocus
              textAlignVertical="top"
              className="flex-1 px-4 py-3 text-base text-gray-900"
            />
          </KeyboardAvoidingView>
        </RNSafeAreaView>
      </Modal>

      {/* Dialog-modal */}
      <Modal visible={visDialogModal} animationType="slide" onRequestClose={() => settVisDialogModal(false)}>
        <RNSafeAreaView className="flex-1 bg-white">
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            className="flex-1"
          >
            <View className="flex-row items-center justify-between border-b border-gray-200 bg-[#1e40af] px-4 py-3">
              <Text className="flex-1 text-base font-semibold text-white">Ny kommentar</Text>
              <Pressable
                onPress={håndterSendKommentar}
                disabled={!dialogTekst.trim() || leggTilKommentarMutasjon.isPending}
                className="ml-3 rounded-lg bg-white/20 px-4 py-1.5"
              >
                <Text className="text-sm font-semibold text-white">
                  {leggTilKommentarMutasjon.isPending ? "Sender..." : "Send"}
                </Text>
              </Pressable>
            </View>
            <TextInput
              value={dialogTekst}
              onChangeText={settDialogTekst}
              placeholder="Skriv kommentar..."
              multiline
              autoFocus
              textAlignVertical="top"
              className="flex-1 px-4 py-3 text-base text-gray-900"
            />
          </KeyboardAvoidingView>
        </RNSafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
