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
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Save, Check, AlertTriangle, Clock, CloudOff, Cloud, Trash2, ChevronDown, Share2, MapPin } from "lucide-react-native";
import { harBetingelse, harForelderObjekt, utledMinRolle } from "@sitedoc/shared";
import type { FlytMedlemInfo } from "@sitedoc/shared";
import { useTranslation } from "react-i18next";
import { FlytIndikator } from "../../src/components/FlytIndikator";
import type { FlytMedlem } from "../../src/components/FlytIndikator";
import { DokumentHandlingsmeny } from "../../src/components/DokumentHandlingsmeny";
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
import { byggSjekklisteHtml } from "@sitedoc/pdf";
import { PdfForhandsvisning } from "../../src/components/PdfForhandsvisning";
import { TegningsVisning } from "../../src/components/TegningsVisning";
import type { Markør } from "../../src/components/TegningsVisning";
import { TegningsCapture } from "../../src/components/TegningsCapture";
import { AUTH_CONFIG, hentWebUrl } from "../../src/config/auth";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { eq } from "drizzle-orm";

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

export default function SjekklisteUtfylling() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { bruker } = useAuth();
  const { valgtProsjektId } = useProsjekt();
  const utils = trpc.useUtils();

  const [visEntrepriseListe, settVisEntrepriseListe] = useState<"oppretter" | "svarer" | null>(null);
  const [pdfHtml, settPdfHtml] = useState<string | null>(null);
  const [visLokasjonModal, setVisLokasjonModal] = useState(false);
  const [visLokByttTegning, setVisLokByttTegning] = useState(false);
  const [lokTempPosX, setLokTempPosX] = useState<number | null>(null);
  const [lokTempPosY, setLokTempPosY] = useState<number | null>(null);
  const [lokTempTegningId, setLokTempTegningId] = useState<string | null>(null);
  const [lokTempBygningId, setLokTempBygningId] = useState<string | null>(null);
  const [tegningScreenshot, setTegningScreenshot] = useState<string | null>(null);
  const [tegningDetaljScreenshot, setTegningDetaljScreenshot] = useState<string | null>(null);

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
    drawing?: { id: string; name: string; drawingNumber?: string | null; fileUrl?: string | null; imageWidth?: number | null; imageHeight?: number | null } | null;
    drawingId?: string | null;
    positionX?: number | null;
    positionY?: number | null;
    byggeplass?: { id: string; name: string } | null;
    bestiller?: { name?: string | null } | null;
    creator?: { name?: string | null } | null;
    createdAt?: string;
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

  // Bygninger og tegninger for lokasjonsvelger
  const bygningerQuery = trpc.bygning.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId },
  );
  const bygninger = (bygningerQuery.data ?? []) as Array<{ id: string; name: string }>;

  const alleTegningerQuery = trpc.tegning.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId },
  );
  const alleTegninger = (alleTegningerQuery.data ?? []) as unknown as Array<{
    id: string; name: string; drawingNumber: string | null;
    fileUrl: string; fileType: string;
    byggeplassId: string | null; byggeplass: { id: string; name: string } | null;
  }>;

  // Lokasjonsinformasjon fra sjekklisteDetalj
  const lokBygningNavn = sjekklisteDetalj?.byggeplass?.name;
  const lokTegningNavn = sjekklisteDetalj?.drawing
    ? (sjekklisteDetalj.drawing.drawingNumber
      ? `${sjekklisteDetalj.drawing.drawingNumber} ${sjekklisteDetalj.drawing.name}`
      : sjekklisteDetalj.drawing.name)
    : null;
  const lokasjonTekst = [lokBygningNavn, lokTegningNavn].filter(Boolean).join(" · ") || null;

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

  const flytMedlemmer = useMemo((): FlytMedlem[] => {
    const sj = sjekklisteDetalj as unknown as { dokumentflytId?: string | null };
    if (!sj?.dokumentflytId || !dokumentflyterRå) return [];
    const rå = dokumentflyterRå as unknown as Array<{ id: string; medlemmer: FlytMedlem[] }>;
    const flyt = rå.find((df) => df.id === sj.dokumentflytId);
    return flyt?.medlemmer ?? [];
  }, [sjekklisteDetalj, dokumentflyterRå]);

  const minRolle = useMemo(() => {
    if (!minFlytInfo || !sjekklisteDetalj) return undefined;
    const sj = sjekklisteDetalj as unknown as { dokumentflytId?: string | null; bestillerEnterprise?: { id: string }; utforerEnterprise?: { id: string } };
    if (!sj.dokumentflytId) return undefined;
    const dokumentflyter = (dokumentflyterRå ?? []) as unknown as Array<{
      id: string;
      medlemmer: Array<{ rolle: string; enterpriseId?: string | null; projectMemberId?: string | null; groupId?: string | null }>;
    }>;
    const flyt = dokumentflyter.find((df) => df.id === sj.dokumentflytId);
    if (!flyt) return null;
    const medlemmer = flyt.medlemmer.map((m): FlytMedlemInfo => ({
      rolle: m.rolle, enterpriseId: m.enterpriseId ?? null,
      projectMemberId: m.projectMemberId ?? null, groupId: m.groupId ?? null,
    }));
    return utledMinRolle(
      { ...minFlytInfo, userId: "", erAdmin: minFlytInfo.erAdmin },
      medlemmer,
      { bestillerEnterpriseId: sj.bestillerEnterprise?.id ?? "", utforerEnterpriseId: sj.utforerEnterprise?.id ?? "" },
    );
  }, [minFlytInfo, sjekklisteDetalj, dokumentflyterRå]);

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
    const webBaseUrl = hentWebUrl();
    const bildeBase = `${webBaseUrl}/api`;
    const sjekklisteMedDetaljer = {
      ...(sjekkliste as Parameters<typeof byggSjekklisteHtml>[0]),
      updatedAt: detalj?.updatedAt as Date | string | undefined,
      changeLog: (detalj?.changeLog ?? []) as Array<{ createdAt: Date | string; user: { name: string | null } }>,
      drawing: sjekklisteDetalj?.drawing ?? null,
      drawingId: sjekklisteDetalj?.drawingId ?? null,
      positionX: sjekklisteDetalj?.positionX ?? null,
      positionY: sjekklisteDetalj?.positionY ?? null,
      building: sjekklisteDetalj?.byggeplass ?? null,
      bestiller: sjekklisteDetalj?.bestiller ?? null,
      creator: sjekklisteDetalj?.creator ?? null,
      createdAt: sjekklisteDetalj?.createdAt,
    };
    const prosjektForPdf = prosjektData ? {
      name: prosjektData.name,
      projectNumber: prosjektData.projectNumber,
      externalProjectNumber: (prosjektData as Record<string, unknown>).externalProjectNumber as string | null | undefined,
      address: prosjektData.address,
      logoUrl: (prosjektData as Record<string, unknown>).logoUrl as string | null | undefined,
    } : null;
    const ui = (prosjektData as Record<string, unknown> | undefined)?.utskriftsinnstillinger as Record<string, boolean> | null | undefined;
    // Tegningsbilde-URL (PNG/bilde-tegninger fungerer direkte, PDF-tegninger ikke)
    const tegningUrl = sjekklisteDetalj?.drawing?.fileUrl
      ? `${bildeBase}${sjekklisteDetalj.drawing.fileUrl}`
      : null;
    return byggSjekklisteHtml(
      sjekklisteMedDetaljer,
      feltVerdierForPdf(),
      prosjektForPdf,
      ui ? {
        logo: ui.logo,
        eksternProsjektnummer: ui.eksternProsjektnummer,
        prosjektnavn: ui.prosjektnavn,
        fraTil: ui.fraTil,
        lokasjon: ui.lokasjon,
        tegningsnummer: ui.tegningsnummer,
        vaer: ui.vaer,
      } : null,
      {
        bildeBaseUrl: bildeBase,
        maksbildeHoyde: 200,
        gjentakendeHeader: true,
        visSidenummer: true,
        tegningBildeUrl: tegningUrl,
        tegningScreenshot,
        tegningDetaljScreenshot,
      },
    );
  }, [sjekkliste, prosjektData, detaljQuery.data as unknown, sjekklisteDetalj, tegningScreenshot, tegningDetaljScreenshot]);

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
      <View className="bg-sitedoc-blue">
        <View className="flex-row items-center px-4 py-3">
          <Pressable onPress={håndterTilbake} hitSlop={12}>
            <ArrowLeft size={22} color="#ffffff" />
          </Pressable>
          <View className="flex-1 px-3">
            <View className="flex-row items-center gap-2">
              {sjekkliste.template?.prefix && sjekklisteNummer != null && (
                <Text className="text-xs font-bold text-white/70">{sjekkliste.template.prefix}{sjekklisteNummer}</Text>
              )}
              <Text className="flex-1 text-sm font-semibold text-white" numberOfLines={1}>
                {sjekkliste.title}
              </Text>
            </View>
            {sjekklisteDetalj?.createdAt && (
              <Text className="text-[10px] text-white/50">
                {new Date(sjekklisteDetalj.createdAt).toLocaleDateString("nb-NO", { day: "2-digit", month: "2-digit", year: "numeric" })}
              </Text>
            )}
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
            <Pressable onPress={erRedigerbar ? håndterVisPdf : håndterDelPdf} hitSlop={12}>
              <Share2 size={18} color="#ffffff" />
            </Pressable>
            <StatusMerkelapp status={sjekkliste.status} />
          </View>
        </View>
        {flytMedlemmer.length > 0 && (
          <FlytIndikator
            medlemmer={flytMedlemmer}
            recipientUserId={(sjekklisteDetalj as { recipientUserId?: string | null } | undefined)?.recipientUserId}
            recipientGroupId={(sjekklisteDetalj as { recipientGroupId?: string | null } | undefined)?.recipientGroupId}
            status={sjekkliste.status}
            bestillerUserId={(sjekklisteDetalj as { bestillerUserId?: string } | undefined)?.bestillerUserId}
          />
        )}
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >

      {/* Felter */}
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-2 p-3 pb-8"
        keyboardShouldPersistTaps="handled"
      >
        {/* Lokasjonsvelger — trykk for å åpne tegningsvisning */}
        <Pressable
          onPress={() => {
            if (leseModus) return;
            // Initialiser temp-state fra nåværende lokasjon
            setLokTempTegningId(sjekklisteDetalj?.drawingId ?? null);
            setLokTempBygningId(sjekklisteDetalj?.byggeplass?.id ?? null);
            setLokTempPosX(sjekklisteDetalj?.positionX ?? null);
            setLokTempPosY(sjekklisteDetalj?.positionY ?? null);
            setVisLokasjonModal(true);
          }}
          className="rounded-lg bg-white px-4 py-3"
        >
          <View className="flex-row items-center gap-2">
            <MapPin size={14} color={lokasjonTekst ? "#1e40af" : "#9ca3af"} />
            <Text className={`flex-1 text-sm ${lokasjonTekst ? "text-gray-800" : "text-gray-400"}`} numberOfLines={1}>
              {lokasjonTekst ?? "Velg lokasjon…"}
            </Text>
            {!leseModus && <ChevronDown size={14} color="#9ca3af" />}
          </View>
        </Pressable>

        {objekter.map((objekt) => {
          // Skip barn av repeatere — rendres inne i RepeaterObjekt
          if (repeaterBarnIder.has(objekt.id)) return null;
          // Sjekk synlighet (betinget felt)
          if (!erSynlig(objekt)) return null;
          // Skip location — rendres som lokasjonsvelger ovenfor
          if (objekt.type === "location") return null;

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
          status={sjekkliste.status}
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
          onSlett={["draft", "cancelled"].includes(sjekkliste.status) ? håndterSlett : undefined}
          alleEntrepriser={(alleEntrepriser ?? []) as Array<{ id: string; name: string; color: string | null }>}
          dokumentflyter={(dokumentflyterRå ?? []) as unknown as Parameters<typeof DokumentHandlingsmeny>[0]["dokumentflyter"]}
          templateId={sjekkliste.template?.id}
          standardEntrepriseId={sjekkliste.utforerEnterprise?.id}
          minRolle={minRolle}
          flytMedlemmer={flytMedlemmer}
          recipientUserId={(sjekklisteDetalj as { recipientUserId?: string | null } | undefined)?.recipientUserId}
          recipientGroupId={(sjekklisteDetalj as { recipientGroupId?: string | null } | undefined)?.recipientGroupId}
          bestillerUserId={(sjekklisteDetalj as { bestillerUserId?: string } | undefined)?.bestillerUserId}
        />

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

      {/* Tegnings-screenshot for PDF (offscreen capture) */}
      {sjekklisteDetalj?.drawing?.fileUrl && sjekklisteDetalj.positionX != null && sjekklisteDetalj.positionY != null && !tegningScreenshot && (
        <TegningsCapture
          tegningUrl={
            sjekklisteDetalj.drawing.fileUrl.startsWith("http")
              ? sjekklisteDetalj.drawing.fileUrl
              : `${hentWebUrl()}/api${sjekklisteDetalj.drawing.fileUrl}`
          }
          positionX={sjekklisteDetalj.positionX}
          positionY={sjekklisteDetalj.positionY}
          onCapture={async (base64) => {
            setTegningScreenshot(base64);
            // Crop detalj-utsnitt via API
            try {
              const resultat = await utils.client.tegning.cropScreenshot.mutate({
                imageBase64: base64,
                positionX: sjekklisteDetalj.positionX!,
                positionY: sjekklisteDetalj.positionY!,
                zoomFaktor: 4,
              });
              setTegningDetaljScreenshot(resultat.croppedBase64);
              console.log("[TegningsCapture] Detalj-crop mottatt, lengde:", resultat.croppedBase64.length);
            } catch (e) {
              console.warn("[TegningsCapture] Crop feilet:", e);
            }
          }}
        />
      )}

      {/* PDF-forhåndsvisning */}
      <PdfForhandsvisning
        synlig={!!pdfHtml}
        html={pdfHtml ?? ""}
        tittel={sjekkliste?.title ?? ""}
        onDel={håndterDelPdf}
        onLukk={() => settPdfHtml(null)}
      />

      {/* Lokasjonsmodal — tegningsvisning med posisjonsprikk */}
      <Modal visible={visLokasjonModal} animationType="slide" onRequestClose={() => setVisLokasjonModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: "#ffffff" }} edges={["top"]}>
          {(() => {
            const aktivTegning = lokTempTegningId
              ? alleTegninger.find((t) => t.id === lokTempTegningId)
              : null;
            const tegningUrl = aktivTegning?.fileUrl
              ? (aktivTegning.fileUrl.startsWith("http")
                ? aktivTegning.fileUrl
                : `${hentWebUrl()}/api${aktivTegning.fileUrl}`)
              : null;

            // «Bytt tegning»-liste — kun når bruker eksplisitt trykker «Bytt tegning»
            if (visLokByttTegning) {
              return (
                <View className="flex-1">
                  <View className="flex-row items-center justify-between bg-sitedoc-blue px-4 py-3">
                    <Pressable onPress={() => setVisLokByttTegning(false)} hitSlop={8}>
                      <Text className="text-sm font-medium text-white">Tilbake</Text>
                    </Pressable>
                    <Text className="text-sm font-semibold text-white">Bytt tegning</Text>
                    <View style={{ width: 50 }} />
                  </View>
                  <ScrollView className="flex-1" contentContainerClassName="p-3 gap-1">
                    {bygninger.map((b) => {
                      const bTegninger = alleTegninger.filter(
                        (t) => (t.byggeplassId ?? t.byggeplass?.id) === b.id && t.fileUrl,
                      );
                      if (bTegninger.length === 0) return null;
                      return (
                        <View key={b.id} className="mb-2">
                          <Text className="text-xs font-semibold uppercase tracking-wider text-gray-400 px-1 mb-1">
                            {b.name}
                          </Text>
                          {bTegninger.map((t) => (
                            <Pressable
                              key={t.id}
                              onPress={() => {
                                setLokTempTegningId(t.id);
                                setLokTempBygningId(t.byggeplassId ?? t.byggeplass?.id ?? null);
                                setLokTempPosX(null);
                                setLokTempPosY(null);
                                setVisLokByttTegning(false);
                              }}
                              className={`rounded-lg px-3 py-2.5 ${lokTempTegningId === t.id ? "bg-blue-50" : "bg-white"}`}
                            >
                              <Text className={`text-sm ${lokTempTegningId === t.id ? "font-medium text-blue-700" : "text-gray-700"}`}>
                                {t.drawingNumber ? `${t.drawingNumber} ${t.name}` : t.name}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              );
            }

            // Ingen tegning valgt — vis tom tilstand med «Velg tegning»-knapp
            if (!tegningUrl) {
              return (
                <View className="flex-1">
                  <View className="flex-row items-center justify-between bg-sitedoc-blue px-4 py-3">
                    <Pressable onPress={() => setVisLokasjonModal(false)} hitSlop={8}>
                      <Text className="text-sm font-medium text-white">Avbryt</Text>
                    </Pressable>
                    <Text className="text-sm font-semibold text-white">Lokasjon</Text>
                    <View style={{ width: 50 }} />
                  </View>
                  <View className="flex-1 items-center justify-center gap-3 px-8">
                    <MapPin size={32} color="#9ca3af" />
                    <Text className="text-center text-sm text-gray-500">
                      Ingen tegning valgt. Velg en tegning for å markere posisjon.
                    </Text>
                    <Pressable
                      onPress={() => setVisLokByttTegning(true)}
                      className="mt-2 rounded-lg bg-blue-700 px-6 py-2.5"
                    >
                      <Text className="text-sm font-medium text-white">Velg tegning</Text>
                    </Pressable>
                  </View>
                </View>
              );
            }

            // Tegningsvisning med posisjonsprikk
            const markører: Markør[] = lokTempPosX != null && lokTempPosY != null
              ? [{ id: "pos", x: lokTempPosX, y: lokTempPosY, farge: "#ef4444" }]
              : [];

            return (
              <View className="flex-1">
                <TegningsVisning
                  tegningUrl={tegningUrl}
                  tegningNavn={aktivTegning?.drawingNumber
                    ? `${aktivTegning.drawingNumber} ${aktivTegning.name}`
                    : aktivTegning?.name ?? ""}
                  onLukk={() => setVisLokasjonModal(false)}
                  onTrykk={(posX, posY) => {
                    setLokTempPosX(posX);
                    setLokTempPosY(posY);
                  }}
                  markører={markører}
                />
                {/* Bunnbar: Bytt tegning + Lagre */}
                <View className="flex-row items-center justify-between border-t border-gray-200 bg-white px-5 py-4">
                  <Pressable onPress={() => setVisLokByttTegning(true)} hitSlop={12} className="rounded-lg px-3 py-2">
                    <Text className="text-sm font-medium text-blue-600">Bytt tegning</Text>
                  </Pressable>
                  <Pressable
                    hitSlop={8}
                    onPress={() => {
                      oppdaterMutasjon.mutate({
                        id: id!,
                        byggeplassId: lokTempBygningId,
                        drawingId: lokTempTegningId,
                        positionX: lokTempPosX,
                        positionY: lokTempPosY,
                      });
                      if (valgtProsjektId && lokTempBygningId && lokTempTegningId) {
                        import("expo-secure-store").then((ss) => {
                          ss.setItemAsync(`sitedoc_sist_bygning_${valgtProsjektId}`, lokTempBygningId!);
                          ss.setItemAsync(`sitedoc_sist_tegning_${valgtProsjektId}`, lokTempTegningId!);
                        });
                      }
                      setVisLokasjonModal(false);
                    }}
                    className="rounded-lg bg-blue-700 px-6 py-2.5"
                  >
                    <Text className="text-sm font-medium text-white">Lagre</Text>
                  </Pressable>
                </View>
              </View>
            );
          })()}
        </SafeAreaView>
      </Modal>

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
