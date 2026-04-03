import { useCallback, useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Save, Check, AlertTriangle, Clock, CloudOff, Cloud, Trash2, ChevronDown, Share2 } from "lucide-react-native";
import { harBetingelse, harForelderObjekt } from "@sitedoc/shared";
import { hentStatusHandlinger } from "@sitedoc/shared";
import type { StatusHandling } from "@sitedoc/shared";
import i18next from "i18next";
import { useSjekklisteSkjema } from "../../src/hooks/useSjekklisteSkjema";
import { useAutoVaer } from "../../src/hooks/useAutoVaer";
import { useOversettelse } from "../../src/hooks/useOversettelse";
import { useOpplastingsKo } from "../../src/providers/OpplastingsKoProvider";
import { useAuth } from "../../src/providers/AuthProvider";
import { StatusMerkelapp } from "../../src/components/StatusMerkelapp";
import { RapportObjektRenderer, DISPLAY_TYPER } from "../../src/components/rapportobjekter";
import { FeltWrapper } from "../../src/components/rapportobjekter/FeltWrapper";
import { MalVelger } from "../../src/components/MalVelger";
import { OpprettDokumentModal } from "../../src/components/OpprettDokumentModal";
import { trpc } from "../../src/lib/trpc";
import { useProsjekt } from "../../src/kontekst/ProsjektKontekst";
import { hentDatabase } from "../../src/db/database";
import { sjekklisteFeltdata, opplastingsKo } from "../../src/db/schema";
import { byggSjekklisteHtml } from "../../src/utils/sjekklistePdf";
import { PdfForhandsvisning } from "../../src/components/PdfForhandsvisning";
import { AUTH_CONFIG } from "../../src/config/auth";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { eq } from "drizzle-orm";

interface Transfer {
  id: string;
  fromStatus: string;
  toStatus: string;
  comment: string | null;
  createdAt: Date | string;
  sender?: { name: string | null } | null;
}

interface EndringsloggRad {
  id: string;
  fieldLabel: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: Date | string;
  user: { id: string; name: string | null; email: string };
}

function formaterLoggVerdi(json: string | null): string {
  if (json == null) return "—";
  try {
    const parsed = JSON.parse(json);
    if (parsed === null || parsed === "") return "—";
    if (typeof parsed === "string") return parsed;
    if (typeof parsed === "number" || typeof parsed === "boolean") return String(parsed);
    if (Array.isArray(parsed)) return parsed.join(", ");
    return json;
  } catch {
    return json;
  }
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

interface MalData {
  id: string;
  name: string;
  prefix: string | null;
  category: string;
}

interface SjekklisteOppgave {
  id: string;
  number: number | null;
  checklistFieldId: string | null;
  title: string;
  status: string;
  template: { prefix: string | null } | null;
}

const t = i18next.t.bind(i18next);

export default function SjekklisteUtfylling() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { bruker } = useAuth();
  const { valgtProsjektId } = useProsjekt();
  const utils = trpc.useUtils();

  const [visEntrepriseListe, settVisEntrepriseListe] = useState<"oppretter" | "svarer" | null>(null);
  const [pdfHtml, settPdfHtml] = useState<string | null>(null);

  // State for oppgave-fra-felt
  const [opprettOppgaveKategori, setOpprettOppgaveKategori] = useState<"oppgave" | null>(null);
  const [opprettOppgaveFeltId, setOpprettOppgaveFeltId] = useState<string | null>(null);
  const [opprettOppgaveFeltLabel, setOpprettOppgaveFeltLabel] = useState<string | null>(null);
  const [valgtOppgaveMal, setValgtOppgaveMal] = useState<MalData | null>(null);

  // Hent overføringer for historikk
  const detaljQuery = trpc.sjekkliste.hentMedId.useQuery(
    { id: id! },
    { enabled: !!id },
  );
  const sjekklisteDetalj = detaljQuery.data as {
    number?: number | null;
    transfers?: Transfer[];
    template?: { enableChangeLog?: boolean };
    changeLog?: EndringsloggRad[];
  } | undefined;
  const overforinger = sjekklisteDetalj?.transfers;
  const sjekklisteNummer = sjekklisteDetalj?.number;

  // Hent oppgaver knyttet til denne sjekklisten
  const oppgaverQuery = trpc.oppgave.hentForSjekkliste.useQuery(
    { checklistId: id! },
    { enabled: !!id },
  );
  const sjekklisteOppgaver = (oppgaverQuery.data ?? []) as SjekklisteOppgave[];

  // Mapping: feltId → oppgave (for badge-visning)
  const feltOppgaveMap = useMemo(() => {
    const map = new Map<string, SjekklisteOppgave>();
    for (const oppgave of sjekklisteOppgaver) {
      if (oppgave.checklistFieldId) {
        map.set(oppgave.checklistFieldId, oppgave);
      }
    }
    return map;
  }, [sjekklisteOppgaver]);

  const { ventende, erAktiv } = useOpplastingsKo();

  // Hent entrepriser for redigering
  const { data: mineEntrepriser } = trpc.medlem.hentMineEntrepriser.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId },
  );
  const { data: alleEntrepriser } = trpc.entreprise.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId },
  );

  const oppdaterMutasjon = trpc.sjekkliste.oppdater.useMutation({
    onSuccess: () => {
      utils.sjekkliste.hentMedId.invalidate({ id: id! });
    },
  });

  const endreStatusMutasjon = trpc.sjekkliste.endreStatus.useMutation({
    onSuccess: () => {
      utils.sjekkliste.hentMedId.invalidate({ id: id! });
      utils.sjekkliste.hentForProsjekt.invalidate();
    },
  });

  const slettMutasjon = trpc.sjekkliste.slett.useMutation({
    onSuccess: () => {
      // Rydd opp lokal SQLite-data
      const db = hentDatabase();
      if (db && id) {
        try {
          db.delete(sjekklisteFeltdata).where(eq(sjekklisteFeltdata.sjekklisteId, id)).run();
          db.delete(opplastingsKo).where(eq(opplastingsKo.sjekklisteId, id)).run();
        } catch {
          // Ignorer SQLite-feil ved opprydding
        }
      }
      utils.sjekkliste.hentForProsjekt.invalidate();
      router.back();
    },
    onError: (feil: { message?: string }) => {
      Alert.alert(t("feil.kunneIkkeSlett"), feil.message || t("feil.ukjentFeil"));
    },
  });

  const håndterSlett = useCallback(() => {
    Alert.alert(
      t("sjekkliste.slettSjekkliste"),
      t("bekreft.slettSjekkliste"),
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

  const håndterStatusEndring = useCallback(
    (handling: StatusHandling) => {
      if (!bruker?.id) return;

      const bekreftTekst = handling.nyStatus === "cancelled" ? t("bekreft.jaAvbrytSjekklisten") : handling.tekst;
      const erDestruktiv = handling.nyStatus === "rejected" || handling.nyStatus === "cancelled";

      Alert.alert(
        t("bekreft.statusendring"),
        t("bekreft.endreStatusTil", { status: handling.tekst.toLowerCase() }),
        [
          { text: t("bekreft.ikkeNaa"), style: "cancel" },
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
                Alert.alert(t("feil.tittel"), t("feil.kunneIkkeEndreStatus"));
              }
            },
          },
        ],
      );
    },
    [bruker?.id, id, endreStatusMutasjon],
  );

  const {
    sjekkliste,
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
  } = useSjekklisteSkjema(id!);

  // On-demand oversettelse av firmainnhold
  const prosjektKildesprak = (sjekklisteDetalj?.template as unknown as { project?: { sourceLanguage?: string } })?.project?.sourceLanguage;
  const {
    oversettelser,
    laster: oversettelseLaster,
    visOversettKnapp,
    oversettFelt,
  } = useOversettelse(
    valgtProsjektId ?? undefined,
    prosjektKildesprak,
    sjekkliste?.template?.objects ?? [],
  );

  // Auto-hent værdata basert på dato og prosjektlokasjon
  useAutoVaer({
    prosjektId: valgtProsjektId,
    alleObjekter: sjekkliste?.template?.objects ?? [],
    hentFeltVerdi,
    settVerdi,
  });

  // Hent prosjektdata for PDF
  const { data: prosjektData } = trpc.prosjekt.hentMedId.useQuery(
    { id: valgtProsjektId! },
    { enabled: !!valgtProsjektId },
  );

  const genererPdfHtml = useCallback(() => {
    if (!sjekkliste) return "";
    const detalj = detaljQuery.data as Record<string, unknown> | undefined;
    const sjekklisteMedDetaljer = {
      ...(sjekkliste as Parameters<typeof byggSjekklisteHtml>[0]),
      updatedAt: detalj?.updatedAt as Date | string | undefined,
      changeLog: (detalj?.changeLog ?? []) as Array<{ createdAt: Date | string; user: { name: string | null } }>,
    };
    return byggSjekklisteHtml(
      sjekklisteMedDetaljer,
      feltVerdierForPdf(),
      prosjektData ? {
        name: prosjektData.name,
        projectNumber: prosjektData.projectNumber,
        externalProjectNumber: (prosjektData as Record<string, unknown>).externalProjectNumber as string | null | undefined,
        address: prosjektData.address,
        logoUrl: (prosjektData as Record<string, unknown>).logoUrl as string | null | undefined,
      } : null,
      AUTH_CONFIG.apiUrl,
    );
  }, [sjekkliste, prosjektData, detaljQuery.data as unknown]);

  // Vis forhåndsvisning
  const håndterVisPdf = useCallback(() => {
    const html = genererPdfHtml();
    if (html) settPdfHtml(html);
  }, [genererPdfHtml]);

  // Del PDF fra forhåndsvisning
  const håndterDelPdf = useCallback(async () => {
    if (!sjekkliste || !pdfHtml) return;
    try {
      const { uri } = await Print.printToFileAsync({ html: pdfHtml });
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: `Del ${sjekkliste.title}`,
        UTI: "com.adobe.pdf",
      });
    } catch (feil) {
      console.warn("PDF-deling feilet:", feil);
    }
  }, [sjekkliste, pdfHtml]);

  // Hjelpefunksjon for å hente feltVerdier som PDF-format
  function feltVerdierForPdf() {
    const resultat: Record<string, { verdi: unknown; kommentar: string; vedlegg: Array<{ id: string; type: string; url: string; filnavn: string }> }> = {};
    for (const objekt of sjekkliste?.template?.objects ?? []) {
      const fv = hentFeltVerdi(objekt.id);
      resultat[objekt.id] = {
        verdi: fv.verdi,
        kommentar: fv.kommentar,
        vedlegg: fv.vedlegg as Array<{ id: string; type: string; url: string; filnavn: string }>,
      };
    }
    return resultat;
  }

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

  // Beregn objekter og repeater-logikk FØR tidlige returns (hooks må alltid kjøres)
  const objekter = useMemo(() =>
    (sjekkliste?.template?.objects ?? []).slice().sort((a, b) => {
      // Sorter topptekst-objekter først, deretter datafelter, så sortOrder innenfor sone
      const zoneA = (a.config as Record<string, unknown>)?.zone === "topptekst" ? 0 : 1;
      const zoneB = (b.config as Record<string, unknown>)?.zone === "topptekst" ? 0 : 1;
      if (zoneA !== zoneB) return zoneA - zoneB;
      return a.sortOrder - b.sortOrder;
    }),
  [sjekkliste]);
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
        <Text className="mt-3 text-sm text-gray-500">{t("sjekkliste.henter")}</Text>
      </SafeAreaView>
    );
  }

  if (!sjekkliste) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-gray-50">
        <Text className="text-base text-gray-500">{t("sjekkliste.ikkeFunnet")}</Text>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text className="text-blue-600">{t("dokument.gaaTilbake")}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const leseModus = !erRedigerbar;

  return (
    <SafeAreaView className="flex-1 bg-gray-100" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between bg-sitedoc-blue px-4 py-3">
        <Pressable onPress={håndterTilbake} hitSlop={12} className="flex-row items-center gap-2">
          <ArrowLeft size={22} color="#ffffff" />
        </Pressable>
        <Text className="flex-1 px-3 text-center text-base font-semibold text-white" numberOfLines={1}>
          {sjekkliste.title}
        </Text>
        {erRedigerbar && (
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
            <Pressable onPress={håndterVisPdf} hitSlop={12}>
              <Share2 size={20} color="#ffffff" />
            </Pressable>
          </View>
        )}
        {!erRedigerbar && (
          <Pressable onPress={håndterDelPdf} hitSlop={12}>
            <Share2 size={20} color="#ffffff" />
          </Pressable>
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
          {sjekkliste.template.prefix && (
            <Text className="text-xs font-medium text-gray-500">
              {sjekkliste.template.prefix}
            </Text>
          )}
          <Text className="text-sm text-gray-700" numberOfLines={1}>
            {sjekkliste.template.name}
          </Text>
        </View>
        <StatusMerkelapp status={sjekkliste.status} />
      </View>

      {/* Entrepriser */}
      {sjekkliste.status === "draft" ? (
        <View className="border-b border-gray-200 bg-white px-4 py-2">
          <View className="flex-row items-center gap-2">
            <Pressable
              className="flex-1"
              onPress={() => settVisEntrepriseListe(visEntrepriseListe === "oppretter" ? null : "oppretter")}
            >
              <Text className="text-[10px] text-gray-400">{t("dokument.fra")}</Text>
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-medium text-gray-700">
                  {sjekkliste.creatorEnterprise?.name ?? t("dokument.velgEntreprise")}
                </Text>
                <ChevronDown size={12} color="#9ca3af" />
              </View>
            </Pressable>
            <Text className="text-xs text-gray-300">→</Text>
            <Pressable
              className="flex-1"
              onPress={() => settVisEntrepriseListe(visEntrepriseListe === "svarer" ? null : "svarer")}
            >
              <Text className="text-right text-[10px] text-gray-400">{t("dokument.til")}</Text>
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-medium text-gray-700">
                  {sjekkliste.responderEnterprise?.name ?? t("dokument.velgEntreprise")}
                </Text>
                <ChevronDown size={12} color="#9ca3af" />
              </View>
            </Pressable>
          </View>
          {visEntrepriseListe === "oppretter" && (
            <View className="mt-1 rounded-lg border border-gray-200 bg-white">
              {(mineEntrepriser ?? []).map((e: { id: string; name: string }) => (
                <Pressable
                  key={e.id}
                  onPress={() => {
                    oppdaterMutasjon.mutate({ id: id!, creatorEnterpriseId: e.id });
                    settVisEntrepriseListe(null);
                  }}
                  className={`border-b border-gray-50 px-3 py-2 ${e.id === sjekkliste.creatorEnterprise?.id ? "bg-blue-50" : ""}`}
                >
                  <Text className={`text-xs ${e.id === sjekkliste.creatorEnterprise?.id ? "font-medium text-blue-700" : "text-gray-700"}`}>
                    {e.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          {visEntrepriseListe === "svarer" && (
            <View className="mt-1 rounded-lg border border-gray-200 bg-white">
              {(alleEntrepriser ?? []).map((e: { id: string; name: string }) => (
                <Pressable
                  key={e.id}
                  onPress={() => {
                    oppdaterMutasjon.mutate({ id: id!, responderEnterpriseId: e.id });
                    settVisEntrepriseListe(null);
                  }}
                  className={`border-b border-gray-50 px-3 py-2 ${e.id === sjekkliste.responderEnterprise?.id ? "bg-blue-50" : ""}`}
                >
                  <Text className={`text-xs ${e.id === sjekkliste.responderEnterprise?.id ? "font-medium text-blue-700" : "text-gray-700"}`}>
                    {e.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      ) : (
        <View className="flex-row border-b border-gray-200 bg-white px-4 py-1.5">
          {sjekkliste.creatorEnterprise && (
            <Text className="flex-1 text-xs text-gray-500">
              {t("dokument.oppretter", { navn: sjekkliste.creatorEnterprise.name })}
            </Text>
          )}
          {sjekkliste.responderEnterprise && (
            <Text className="flex-1 text-right text-xs text-gray-500">
              {t("dokument.svarer", { navn: sjekkliste.responderEnterprise.name })}
            </Text>
          )}
        </View>
      )}

      {/* Felter */}
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-2 p-3 pb-8"
        keyboardShouldPersistTaps="handled"
      >
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

          // Oppgave-kobling for dette feltet
          const feltOppgave = feltOppgaveMap.get(objekt.id);
          const oppgaveNummer = feltOppgave
            ? `${feltOppgave.template?.prefix ?? ""}${feltOppgave.number ?? ""}`
            : undefined;

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
              sjekklisteId={sjekkliste.id}
              nestingNivå={nestingNivå}
              valideringsfeil={valideringsfeil[objekt.id]}
              oppgaveNummer={oppgaveNummer && oppgaveNummer.trim() ? oppgaveNummer : undefined}
              oppgaveId={feltOppgave?.id}
              onOpprettOppgave={() => {
                setOpprettOppgaveFeltId(objekt.id);
                setOpprettOppgaveFeltLabel(objekt.label);
                setOpprettOppgaveKategori("oppgave");
              }}
              onNavigerTilOppgave={(oppgaveId) => router.push(`/oppgave/${oppgaveId}`)}
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
                sjekklisteId={sjekkliste.id}
              />
            </FeltWrapper>
          );
        })}

        {/* Endringslogg */}
        {sjekklisteDetalj?.template?.enableChangeLog && (sjekklisteDetalj?.changeLog ?? []).length > 0 && (
          <View className="mt-4">
            <View className="flex-row items-center gap-2 px-1 pb-2">
              <Clock size={16} color="#6b7280" />
              <Text className="text-sm font-semibold text-gray-700">{t("dokument.endringslogg")}</Text>
            </View>
            <View className="rounded-lg bg-white">
              {(sjekklisteDetalj.changeLog ?? []).map((rad, i) => (
                <View
                  key={rad.id}
                  className={`px-3 py-2.5 ${i > 0 ? "border-t border-gray-100" : ""}`}
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs font-medium text-gray-700">
                      {rad.user.name ?? rad.user.email}
                    </Text>
                    <Text className="text-xs text-gray-400">
                      {formaterHistorikkDato(rad.createdAt)}
                    </Text>
                  </View>
                  <Text className="mt-0.5 text-xs text-gray-600">
                    {t("dokument.endret")} <Text className="font-medium">{rad.fieldLabel}</Text>
                    {rad.oldValue != null && ` fra «${formaterLoggVerdi(rad.oldValue)}»`}
                    {` til «${formaterLoggVerdi(rad.newValue)}»`}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Historikk */}
        {overforinger && overforinger.length > 0 && (
          <View className="mt-4">
            <View className="flex-row items-center gap-2 px-1 pb-2">
              <Clock size={16} color="#6b7280" />
              <Text className="text-sm font-semibold text-gray-700">{t("dokument.historikk")}</Text>
            </View>
            <View className="rounded-lg bg-white">
              {overforinger.map((ovf, i) => (
                <View
                  key={ovf.id}
                  className={`flex-row items-center gap-2 px-3 py-2.5 ${i > 0 ? "border-t border-gray-100" : ""}`}
                >
                  <View className="flex-1">
                    <View className="flex-row items-center gap-1.5">
                      <StatusMerkelapp status={ovf.fromStatus} />
                      <Text className="text-xs text-gray-400">→</Text>
                      <StatusMerkelapp status={ovf.toStatus} />
                    </View>
                    {ovf.sender?.name && (
                      <Text className="mt-0.5 text-xs text-gray-500">{ovf.sender.name}</Text>
                    )}
                    {ovf.comment && (
                      <Text className="mt-0.5 text-xs text-gray-600">{ovf.comment}</Text>
                    )}
                  </View>
                  <Text className="text-xs text-gray-400">
                    {formaterHistorikkDato(ovf.createdAt)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Statusknapper + lagre-knapp i bunn */}
      <View className="border-t border-gray-200 bg-white px-4 py-3">
        {/* Statushandlinger (filtrer ut deleted/forwarded — krever spesialbehandling) */}
        {sjekkliste && (() => {
          const handlinger = hentStatusHandlinger(sjekkliste.status)
            .filter((h) => h.nyStatus !== "deleted" && h.nyStatus !== "forwarded");
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
              {erLagrer ? t("handling.lagrer") : t("dokument.lagreUtfylling")}
            </Text>
          </Pressable>
        )}

        {/* Slett-knapp (utkast og avbrutte) */}
        {(sjekkliste?.status === "draft" || sjekkliste?.status === "cancelled") && (
          <Pressable
            onPress={håndterSlett}
            disabled={slettMutasjon.isPending}
            className="mt-2 flex-row items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 py-3"
          >
            <Trash2 size={16} color="#dc2626" />
            <Text className="font-medium text-red-600">
              {slettMutasjon.isPending ? t("handling.sletter") : t("sjekkliste.slettSjekkliste")}
            </Text>
          </Pressable>
        )}
      </View>

      </KeyboardAvoidingView>

      {/* PDF-forhåndsvisning */}
      <PdfForhandsvisning
        synlig={!!pdfHtml}
        html={pdfHtml ?? ""}
        tittel={sjekkliste?.title ?? ""}
        onDel={håndterDelPdf}
        onLukk={() => settPdfHtml(null)}
      />

      {/* Malvelger for oppgave fra felt */}
      <MalVelger
        synlig={opprettOppgaveKategori === "oppgave" && !valgtOppgaveMal}
        kategori="oppgave"
        onVelg={(mal) => setValgtOppgaveMal(mal)}
        onLukk={() => {
          setOpprettOppgaveKategori(null);
          setOpprettOppgaveFeltId(null);
          setOpprettOppgaveFeltLabel(null);
        }}
      />

      {/* Opprett oppgave fra felt-modal */}
      <OpprettDokumentModal
        synlig={opprettOppgaveKategori === "oppgave" && !!valgtOppgaveMal}
        kategori="oppgave"
        mal={valgtOppgaveMal ?? { id: "", name: "", prefix: null, category: "" }}
        sjekklisteId={sjekkliste?.id}
        sjekklisteFeltId={opprettOppgaveFeltId ?? undefined}
        sjekklisteNummer={
          sjekkliste?.template.prefix && sjekklisteNummer != null
            ? `${sjekkliste.template.prefix}${sjekklisteNummer}`
            : undefined
        }
        feltLabel={opprettOppgaveFeltLabel ?? undefined}
        onOpprettet={(oppgaveId) => {
          setValgtOppgaveMal(null);
          setOpprettOppgaveKategori(null);
          setOpprettOppgaveFeltId(null);
          setOpprettOppgaveFeltLabel(null);
          // Oppdater oppgavelisten for denne sjekklisten
          utils.oppgave.hentForSjekkliste.invalidate({ checklistId: id! });
          // Naviger til oppgave-detaljskjerm
          router.push(`/oppgave/${oppgaveId}`);
        }}
        onLukk={() => {
          setValgtOppgaveMal(null);
          setOpprettOppgaveKategori(null);
          setOpprettOppgaveFeltId(null);
          setOpprettOppgaveFeltLabel(null);
        }}
      />
    </SafeAreaView>
  );
}
