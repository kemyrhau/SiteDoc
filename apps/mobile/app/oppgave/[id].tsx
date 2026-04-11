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
import { harBetingelse, harForelderObjekt, utledMinRolle } from "@sitedoc/shared";
import type { FlytMedlemInfo } from "@sitedoc/shared";
import { useTranslation } from "react-i18next";
import { FlytIndikator } from "../../src/components/FlytIndikator";
import type { FlytMedlem } from "../../src/components/FlytIndikator";
import { DokumentHandlingsmeny } from "../../src/components/DokumentHandlingsmeny";
import { useOppgaveSkjema } from "../../src/hooks/useOppgaveSkjema";
import { useAutoVaer } from "../../src/hooks/useAutoVaer";
import { useOversettelse } from "../../src/hooks/useOversettelse";
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
  { verdi: "low", labelKey: "prioritet.lav", farge: "bg-gray-200 text-gray-700" },
  { verdi: "medium", labelKey: "prioritet.medium", farge: "bg-blue-100 text-blue-700" },
  { verdi: "high", labelKey: "prioritet.hoy", farge: "bg-orange-100 text-orange-700" },
  { verdi: "critical", labelKey: "prioritet.kritisk", farge: "bg-red-100 text-red-700" },
] as const;

interface Transfer {
  id: string;
  fromStatus: string;
  toStatus: string;
  comment: string | null;
  createdAt: Date | string;
  sender?: { id: string; name: string | null } | null;
  recipientUser?: { id: string; name: string | null } | null;
  recipientGroup?: { id: string; name: string | null } | null;
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
  const { t } = useTranslation();
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

  // Flytdata for ny handlingsmeny
  const { data: minFlytInfo } = trpc.gruppe.hentMinFlytInfo.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId },
  );
  const { data: dokumentflyterRå } = trpc.dokumentflyt.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId },
  );

  // Utled flytmedlemmer og rolle
  const flytMedlemmer = useMemo((): FlytMedlem[] => {
    const op = oppgaveDetalj as unknown as { dokumentflytId?: string | null };
    if (!op?.dokumentflytId || !dokumentflyterRå) return [];
    const rå = dokumentflyterRå as unknown as Array<{
      id: string;
      medlemmer: FlytMedlem[];
    }>;
    const flyt = rå.find((df) => df.id === op.dokumentflytId);
    return flyt?.medlemmer ?? [];
  }, [oppgaveDetalj, dokumentflyterRå]);

  const minRolle = useMemo(() => {
    if (!minFlytInfo || !oppgaveDetalj) return undefined;
    const op = oppgaveDetalj as unknown as { dokumentflytId?: string | null; bestillerEnterprise?: { id: string }; utforerEnterprise?: { id: string } };
    if (!op.dokumentflytId) return undefined;
    const dokumentflyter = (dokumentflyterRå ?? []) as unknown as Array<{
      id: string;
      medlemmer: Array<{ rolle: string; enterpriseId?: string | null; projectMemberId?: string | null; groupId?: string | null }>;
    }>;
    const flyt = dokumentflyter.find((df) => df.id === op.dokumentflytId);
    if (!flyt) return null;
    const medlemmer = flyt.medlemmer.map((m): FlytMedlemInfo => ({
      rolle: m.rolle,
      enterpriseId: m.enterpriseId ?? null,
      projectMemberId: m.projectMemberId ?? null,
      groupId: m.groupId ?? null,
    }));
    return utledMinRolle(
      { ...minFlytInfo, userId: "", erAdmin: minFlytInfo.erAdmin },
      medlemmer,
      { bestillerEnterpriseId: op.bestillerEnterprise?.id ?? "", utforerEnterpriseId: op.utforerEnterprise?.id ?? "" },
    );
  }, [minFlytInfo, oppgaveDetalj, dokumentflyterRå]);

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
      Alert.alert(t("feil.kunneIkkeSlett"), feil.message || t("feil.ukjentFeil"));
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
      t("oppgave.slettOppgave"),
      t("bekreft.slettOppgave"),
      [
        { text: t("handling.avbryt"), style: "cancel" },
        {
          text: t("handling.slett"),
          style: "destructive",
          onPress: () => slettMutasjon.mutate({ id: id! }),
        },
      ],
    );
  }, [id, slettMutasjon]);

  const {
    oppgave,
    erLaster,
    hentFeltVerdi,
    settVerdi,
    settKommentar,
    leggTilVedlegg,
    fjernVedlegg,
    erstattVedlegg,
    flyttVedlegg,
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

  // On-demand oversettelse av firmainnhold
  const prosjektKildesprak = (detaljQuery.data as unknown as { template?: { project?: { sourceLanguage?: string } } })?.template?.project?.sourceLanguage;
  const {
    oversettelser,
    laster: oversettelseLaster,
    visOversettKnapp,
    oversettFelt,
  } = useOversettelse(
    valgtProsjektId ?? undefined,
    prosjektKildesprak,
    oppgave?.template?.objects ?? [],
  );

  // Auto-hent værdata basert på dato og prosjektlokasjon
  useAutoVaer({
    prosjektId: valgtProsjektId,
    alleObjekter: oppgave?.template?.objects ?? [],
    hentFeltVerdi,
    settVerdi,
  });

  const håndterTilbake = useCallback(async () => {
    if (harEndringer) {
      await lagre();
    }
    router.back();
  }, [harEndringer, lagre, router]);

  const håndterLagre = useCallback(async () => {
    const erGyldig = valider();
    if (!erGyldig) {
      Alert.alert(t("dokument.valideringsfeil"), t("dokument.fyllInnPaakrevde"));
      return;
    }
    await lagre();
    Alert.alert(t("dokument.lagret"), t("dokument.utfyllingLagret"));
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
        <Text className="mt-3 text-sm text-gray-500">{t("oppgave.henter")}</Text>
      </SafeAreaView>
    );
  }

  if (!oppgave) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-gray-50">
        <Text className="text-base text-gray-500">{t("oppgave.ikkeFunnet")}</Text>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text className="text-blue-600">{t("dokument.gaaTilbake")}</Text>
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
      <View className="bg-sitedoc-blue">
        <View className="flex-row items-center px-4 py-3">
          <Pressable onPress={håndterTilbake} hitSlop={12}>
            <ArrowLeft size={22} color="#ffffff" />
          </Pressable>
          <View className="flex-1 flex-row items-center gap-2 px-3">
            {nummer && (
              <Text className="text-xs font-bold text-white/70">{nummer}</Text>
            )}
            <Text className="flex-1 text-sm font-semibold text-white" numberOfLines={1}>
              {oppgave.title}
            </Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            {erRedigerbar && (
              <>
                {ventende > 0 && (
                  <View className="flex-row items-center gap-1">
                    <ActivityIndicator size="small" color="#fbbf24" />
                    <Text className="text-[10px] text-yellow-200">{ventende}</Text>
                  </View>
                )}
                {synkStatus === "synkroniserer" && <ActivityIndicator size="small" color="#93c5fd" />}
                {synkStatus === "lokalt_lagret" && ventende === 0 && <CloudOff size={14} color="#fbbf24" />}
                {synkStatus === "synkronisert" && ventende === 0 && lagreStatus === "idle" && <Cloud size={14} color="#86efac" />}
                {lagreStatus === "lagrer" && <ActivityIndicator size="small" color="#93c5fd" />}
                {lagreStatus === "lagret" && <Check size={16} color="#86efac" />}
                {lagreStatus === "feil" && <AlertTriangle size={16} color="#fca5a5" />}
              </>
            )}
            <StatusMerkelapp status={oppgave.status} />
          </View>
        </View>
        {/* FlytIndikator */}
        {flytMedlemmer.length > 0 && (
          <FlytIndikator
            medlemmer={flytMedlemmer}
            recipientUserId={(oppgaveDetalj as { recipientUserId?: string | null } | undefined)?.recipientUserId}
            recipientGroupId={(oppgaveDetalj as { recipientGroupId?: string | null } | undefined)?.recipientGroupId}
            status={oppgave.status}
            bestillerUserId={(oppgaveDetalj as { bestillerUserId?: string } | undefined)?.bestillerUserId}
          />
        )}
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >

      {/* Mal-navn (kompakt) */}
      <View className="border-b border-gray-200 bg-white px-4 py-1.5">
        <Text className="text-xs text-gray-400" numberOfLines={1}>
          {oppgave.template?.name}
        </Text>
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
              <Text className="text-[10px] text-gray-400">{t("dokument.fra")}</Text>
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-medium text-gray-700">
                  {oppgave.bestillerEnterprise?.name ?? t("dokument.velgEntreprise")}
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
              <Text className="text-right text-[10px] text-gray-400">{t("dokument.til")}</Text>
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-medium text-gray-700">
                  {oppgave.utforerEnterprise?.name ?? t("dokument.velgEntreprise")}
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
                    oppdaterMutasjon.mutate({ id: id!, bestillerEnterpriseId: e.id });
                    settVisEntrepriseListe(null);
                  }}
                  className={`border-b border-gray-50 px-3 py-2 ${e.id === oppgave.bestillerEnterprise?.id ? "bg-blue-50" : ""}`}
                >
                  <Text className={`text-xs ${e.id === oppgave.bestillerEnterprise?.id ? "font-medium text-blue-700" : "text-gray-700"}`}>
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
                    oppdaterMutasjon.mutate({ id: id!, utforerEnterpriseId: e.id });
                    settVisEntrepriseListe(null);
                  }}
                  className={`border-b border-gray-50 px-3 py-2 ${e.id === oppgave.utforerEnterprise?.id ? "bg-blue-50" : ""}`}
                >
                  <Text className={`text-xs ${e.id === oppgave.utforerEnterprise?.id ? "font-medium text-blue-700" : "text-gray-700"}`}>
                    {e.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      ) : (
        <View className="flex-row border-b border-gray-200 bg-white px-4 py-1.5">
          {oppgave.bestillerEnterprise && (
            <Text className="flex-1 text-xs text-gray-500">
              {t("dokument.oppretter", { navn: oppgave.bestillerEnterprise.name })}
            </Text>
          )}
          {oppgave.utforerEnterprise && (
            <Text className="flex-1 text-right text-xs text-gray-500">
              {t("dokument.svarer", { navn: oppgave.utforerEnterprise.name })}
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
          <Text className="mb-1 text-xs font-medium text-gray-500">{t("oppgave.tittelLabel")}</Text>
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

        {/* Prioritet (skjulbar via mal) */}
        {(oppgave.template as Record<string, unknown>)?.showPriority !== false && (
        <View className="rounded-lg bg-white p-4">
          <Text className="mb-2 text-xs font-medium text-gray-500">{t("oppgave.prioritet")}</Text>
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
                    {t(p.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        )}

        {/* Beskrivelse */}
        <View className="rounded-lg bg-white p-4">
          <Text className="mb-1 text-xs font-medium text-gray-500">{t("oppgave.beskrivelse")}</Text>
          <Pressable
            onPress={() => {
              if (leseModus) return;
              settBeskrivelseUtkast(oppgave.description ?? "");
              settVisBeskrivelseModal(true);
            }}
          >
            <Text className={`text-sm ${oppgave.description ? "text-gray-800" : "text-gray-400 italic"}`}>
              {oppgave.description || t("oppgave.leggTilBeskrivelse")}
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
              <Text className="text-xs font-medium text-blue-600">{t("oppgave.fraSjekkliste")}</Text>
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
              <Text className="text-xs font-medium text-purple-600">{t("oppgave.fraTegning")}</Text>
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
              onErstattVedlegg={(vId, nyUrl, nyttFilnavn) => erstattVedlegg(objekt.id, vId, nyUrl, nyttFilnavn)}
              onFlyttVedlegg={(vId, retning) => flyttVedlegg(objekt.id, vId, retning)}
              leseModus={leseModus}
              oppgaveIdForKo={oppgave.id}
              nestingNivå={nestingNivå}
              valideringsfeil={valideringsfeil[objekt.id]}
              oversettelser={oversettelser}
              oversettelseLaster={oversettelseLaster}
              onOversett={() => oversettFelt(objekt)}
              visOversettKnapp={visOversettKnapp}
              originalData={(feltVerdi as unknown as { original?: { spraak: string; verdi?: string; kommentar?: string } }).original}
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
                {t("oppgave.dialog")} {kommentarer.length > 0 ? `(${kommentarer.length})` : ""}
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
              <Text className="text-xs font-medium text-blue-600">{t("oppgave.ny")}</Text>
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
              <Text className="text-center text-xs text-gray-400">{t("oppgave.ingenKommentarer")}</Text>
            </View>
          )}
        </View>

        {/* Tidslinje */}
        {overforinger && overforinger.length > 0 && (
          <View className="mt-4">
            <View className="flex-row items-center gap-2 px-1 pb-2">
              <Clock size={16} color="#6b7280" />
              <Text className="text-sm font-semibold text-gray-700">{t("tidslinje.tittel")}</Text>
            </View>
            <View className="rounded-lg bg-white px-3 py-2">
              {overforinger.map((ovf, i) => {
                const erSiste = i === overforinger.length - 1;
                const harMottaker = ovf.recipientUser || ovf.recipientGroup;
                return (
                  <View key={ovf.id} className="flex-row">
                    {/* Vertikal linje + prikk */}
                    <View className="mr-3 items-center" style={{ width: 16 }}>
                      <View
                        className={`h-3 w-3 rounded-full ${erSiste ? "bg-blue-600" : "bg-gray-400"}`}
                        style={{ marginTop: 4 }}
                      />
                      {!erSiste && (
                        <View className="flex-1 bg-gray-200" style={{ width: 1 }} />
                      )}
                    </View>

                    {/* Innhold */}
                    <View className={`flex-1 ${!erSiste ? "pb-3" : ""}`}>
                      <View className="flex-row items-center gap-1.5">
                        <StatusMerkelapp status={ovf.fromStatus} />
                        <Text className="text-xs text-gray-400">→</Text>
                        <StatusMerkelapp status={ovf.toStatus} />
                        <Text className="ml-auto text-xs text-gray-400">
                          {formaterHistorikkDato(ovf.createdAt)}
                        </Text>
                      </View>
                      {/* Avsender → Mottaker */}
                      <View className="mt-0.5 flex-row items-center gap-1">
                        {ovf.sender?.name && (
                          <Text className="text-xs text-gray-500">{ovf.sender.name}</Text>
                        )}
                        {harMottaker && (
                          <>
                            <Text className="text-xs text-gray-400">→</Text>
                            <Text className="text-xs text-gray-500">
                              {ovf.recipientUser?.name ?? ovf.recipientGroup?.name}
                            </Text>
                          </>
                        )}
                      </View>
                      {ovf.comment && (
                        <Text className="mt-0.5 text-xs italic text-gray-500">
                          &ldquo;{ovf.comment}&rdquo;
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Handlingsmeny + lagre-knapp i bunn */}
      <View className="border-t border-gray-200 bg-white px-4 py-3 gap-2">
        <DokumentHandlingsmeny
          status={oppgave.status}
          erLaster={endreStatusMutasjon.isPending}
          onEndreStatus={(nyStatus, kommentarTekst, mottaker) => {
            endreStatusMutasjon.mutate({
              id: id!,
              nyStatus: nyStatus as "draft" | "sent" | "received" | "in_progress" | "responded" | "approved" | "rejected" | "closed" | "cancelled",
              senderId: bruker?.id ?? "",
              kommentar: kommentarTekst,
              recipientUserId: mottaker?.userId,
              recipientGroupId: mottaker?.groupId,
              dokumentflytId: mottaker?.dokumentflytId,
            });
          }}
          onSlett={["draft", "cancelled"].includes(oppgave.status) ? håndterSlett : undefined}
          alleEntrepriser={(alleEntrepriser ?? []) as Array<{ id: string; name: string; color: string | null }>}
          dokumentflyter={(dokumentflyterRå ?? []) as unknown as Parameters<typeof DokumentHandlingsmeny>[0]["dokumentflyter"]}
          templateId={oppgave.template?.id}
          standardEntrepriseId={oppgave.utforerEnterprise?.id}
          minRolle={minRolle}
          flytMedlemmer={flytMedlemmer}
          recipientUserId={(oppgaveDetalj as { recipientUserId?: string | null } | undefined)?.recipientUserId}
          recipientGroupId={(oppgaveDetalj as { recipientGroupId?: string | null } | undefined)?.recipientGroupId}
          bestillerUserId={(oppgaveDetalj as { bestillerUserId?: string } | undefined)?.bestillerUserId}
        />

        {/* Lagre-knapp */}
        {erRedigerbar && (
          <Pressable
            onPress={håndterLagre}
            disabled={erLagrer}
            className={`items-center rounded-lg py-3 ${erLagrer ? "bg-blue-400" : "bg-blue-600"}`}
          >
            <Text className="font-medium text-white">
              {erLagrer ? t("handling.lagrer") : t("dokument.lagreUtfylling")}
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
              <Text className="flex-1 text-base font-semibold text-white">{t("oppgave.redigerTittel")}</Text>
              <Pressable
                onPress={lagreTittel}
                className="ml-3 rounded-lg bg-white/20 px-4 py-1.5"
              >
                <Text className="text-sm font-semibold text-white">{t("oppgave.ferdig")}</Text>
              </Pressable>
            </View>
            <TextInput
              value={tittelUtkast}
              onChangeText={settTittelUtkast}
              placeholder={t("oppgave.tittelPlaceholder")}
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
              <Text className="flex-1 text-base font-semibold text-white">{t("oppgave.beskrivelse")}</Text>
              <Pressable
                onPress={lagreBeskrivelse}
                className="ml-3 rounded-lg bg-white/20 px-4 py-1.5"
              >
                <Text className="text-sm font-semibold text-white">{t("oppgave.ferdig")}</Text>
              </Pressable>
            </View>
            <TextInput
              value={beskrivelseUtkast}
              onChangeText={settBeskrivelseUtkast}
              placeholder={t("oppgave.beskrivelsePlaceholder")}
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
              <Text className="flex-1 text-base font-semibold text-white">{t("oppgave.nyKommentar")}</Text>
              <Pressable
                onPress={håndterSendKommentar}
                disabled={!dialogTekst.trim() || leggTilKommentarMutasjon.isPending}
                className="ml-3 rounded-lg bg-white/20 px-4 py-1.5"
              >
                <Text className="text-sm font-semibold text-white">
                  {leggTilKommentarMutasjon.isPending ? t("handling.sender") : t("handling.send")}
                </Text>
              </Pressable>
            </View>
            <TextInput
              value={dialogTekst}
              onChangeText={settDialogTekst}
              placeholder={t("oppgave.skrivKommentar")}
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
