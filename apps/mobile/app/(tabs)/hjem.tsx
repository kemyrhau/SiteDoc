import { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  ActionSheetIOS,
  Platform,
  Modal as RNModal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  ClipboardCheck,
  ListTodo,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  Building2,
  WifiOff,
} from "lucide-react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { velgDokumentVisning } from "@sitedoc/shared";
import { trpc } from "../../src/lib/trpc";
import { useProsjekt } from "../../src/kontekst/ProsjektKontekst";
import { useByggeplass } from "../../src/kontekst/ByggeplassKontekst";
import { useAuth } from "../../src/providers/AuthProvider";
import { useProsjektListe } from "../../src/hooks/useProsjektListe";
import { hentSjekklisterLokalt } from "../../src/services/sjekklisteKatalog";
import { hentOppgaverLokalt } from "../../src/services/oppgaveKatalog";
import { ProsjektVelger } from "../../src/components/ProsjektVelger";
import { useFirma } from "../../src/kontekst/FirmaKontekst";
import { FirmaVelger } from "../../src/components/FirmaVelger";
import { OpprettVelger } from "../../src/components/OpprettVelger";
import { formaterNummer } from "../../src/components/dokumentliste/DokumentRadHjelpere";
import { HjemTimerChip } from "../../src/components/HjemTimerChip";
import { MannskapInnsjekkKort } from "../../src/components/MannskapInnsjekkKort";
import { ByggeplassChip } from "../../src/components/ByggeplassChip";

const AKTIVE_STATUSER = ["sent", "received", "in_progress"];


// Fabel C: antall innboksrader vist inline på Hjem før «Se alle»-raden.
const INNBOKS_MAKS = 3;

interface InnboksElement {
  id: string;
  type: "sjekkliste" | "oppgave";
  tittel: string;
  nummer: string | null;
  undertekst: string;
  bygning: string | null;
  tidspunkt: Date | string;
  status: string;
}

function formaterTidspunkt(dato: Date | string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const d = new Date(dato);
  const na = new Date();
  const diffMs = na.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffTimer = Math.floor(diffMs / 3600000);
  const diffDager = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return t("tid.akkuratNaa");
  if (diffMin < 60) return t("tid.minSiden", { n: diffMin });
  if (diffTimer < 24) return t("tid.timerSiden", { n: diffTimer });
  if (diffDager < 7) return t("tid.dagerSiden", { n: diffDager });
  return d.toLocaleDateString("nb-NO", { day: "numeric", month: "short" });
}

function formaterSistOppdatert(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }) + ", " + d.toLocaleTimeString("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const PRIORITETS_NOEKLER: Record<string, string> = {
  low: "prioritet.lavPrioritet",
  medium: "prioritet.mediumPrioritet",
  high: "prioritet.hoyPrioritet",
  critical: "prioritet.kritisk",
};

export default function HjemSkjerm() {
  const { t } = useTranslation();
  const { valgtProsjektId } = useProsjekt();
  const { valgtBygningId } = useByggeplass();
  const [velgerSynlig, setVelgerSynlig] = useState(false);
  const [visFirmaVelger, setVisFirmaVelger] = useState(false);
  const [opprettKategori, setOpprettKategori] = useState<"sjekkliste" | "oppgave" | null>(null);
  const [visAndroidMeny, setVisAndroidMeny] = useState(false);
  // Fabel C: «Se alle»/«Vis færre» utvider innboksen inline til dagens tak (10).
  // Lokal (ikke persistert) — resettes ved remount, bevisst enkel løsning.
  const { valgtFirmaId, firmaer } = useFirma();
  const { bruker } = useAuth();
  const router = useRouter();
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();

  // Prosjekter via delt hook med offline-fallback til prosjekt_local (feltfunn 2026-10-04):
  // Hjem er eneste inngang til listene, så en nett-only feilside stengte veien til de
  // offline-lagrede dokumentene. Hooken faller tilbake til lokal cache uten nett, med
  // samme pause-regel som fase 2. Delt med prosjektvelgeren og «Ny dagsseddel».
  const {
    visning: prosjektVisning,
    prosjekter: prosjektListe,
    erFrakoblet: prosjektFrakoblet,
    erPaaNettet,
    feilmelding: prosjektFeilmelding,
    refetch: refetchProsjekt,
  } = useProsjektListe();
  const valgtProsjekt = prosjektListe.find((p) => p.id === valgtProsjektId);

  // Hent bygninger for å vise valgt bygningsnavn
  const bygningQuery = trpc.bygning.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId },
  );
  type BygningMedTegninger = { id: string; name: string; drawings: Array<{ fileType: string | null }> };
  const bygninger = bygningQuery.data as BygningMedTegninger[] | undefined;

  // F2: valgt byggeplass vises nå via delt ByggeplassChip (øverst i ScrollView),
  // ikke som subtittel i header — én tappbar byggeplass-kontroll.

  // Sjekk om 3D-visning modulen er aktiv
  const modulQuery = trpc.modul.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId },
  );
  // Lean cast (som prosjektListe): tRPC-modul-output har dyp config-Json.
  const moduler = modulQuery.data as Array<{ moduleSlug: string; active: boolean }> | undefined;
  const er3dAktiv = useMemo(() => {
    if (!moduler) return false;
    return moduler.some((m) => m.moduleSlug === "3d-visning" && m.active);
  }, [moduler]);

  const erPsiAktiv = useMemo(() => {
    if (!moduler) return false;
    return moduler.some((m) => m.moduleSlug === "psi" && m.active);
  }, [moduler]);

  // Hent PSI-er og status per PSI
  const psiQuery = trpc.psi.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId && erPsiAktiv },
  );
  type PsiData = { id: string; version: number; byggeplassId: string | null; byggeplass: { id: string; name: string } | null; template: { id: string; name: string; prefix: string | null } };
  // Klient-typen matcher nå server-output (psi.ts include: byggeplass).
  const psiListe = (psiQuery.data ?? []) as PsiData[];

  // Sjekk om valgt bygning har IFC-modeller OG 3D-modulen er aktiv
  const harIfcModeller = useMemo(() => {
    if (!er3dAktiv) return false;
    if (!valgtBygningId || !bygninger) return false;
    const bygning = bygninger.find((b) => b.id === valgtBygningId);
    if (!bygning) return false;
    return bygning.drawings.some((d) => d.fileType?.toLowerCase() === "ifc");
  }, [er3dAktiv, valgtBygningId, bygninger]);

  // Hent sjekklister og oppgaver for valgt prosjekt (filtrert på bygning)
  const sjekklisteQuery = trpc.sjekkliste.hentForProsjekt.useQuery(
    {
      projectId: valgtProsjektId!,
      ...(valgtBygningId ? { byggeplassId: valgtBygningId } : {}),
    },
    { enabled: !!valgtProsjektId },
  );

  const oppgaveQuery = trpc.oppgave.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId },
  );

  // Cast tRPC-data for å unngå TS2589 (excessively deep type instantiation)
  const sjekklister = sjekklisteQuery.data as
    | Array<{ id: string; title: string; status: string; number?: number | null; updatedAt: Date | string; template?: { name: string; prefix?: string | null } | null; byggeplass?: { name: string } | null }>
    | undefined;

  const oppgaver = oppgaveQuery.data as
    | Array<{ id: string; title: string; status: string; priority: string; number?: number | null; updatedAt: Date | string; template?: { name: string; prefix?: string | null } | null }>
    | undefined;

  // Offline-fallback for innboksen: aktive sjekklister + oppgaver fra de lokale katalogene
  // (samme kilde listeskjermene bruker). Bruker-scopet (userId), byggeplass-scopet likt server.
  const brukerId = bruker?.id;
  const effektivBygg = valgtBygningId ?? undefined;
  const lokaleSjekklister = useMemo(
    () => (valgtProsjektId && brukerId ? hentSjekklisterLokalt(valgtProsjektId, brukerId, effektivBygg) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [valgtProsjektId, brukerId, effektivBygg, sjekklisteQuery.status],
  );
  const lokaleOppgaver = useMemo(
    () => (valgtProsjektId && brukerId ? hentOppgaverLokalt(valgtProsjektId, brukerId) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [valgtProsjektId, brukerId, oppgaveQuery.status],
  );

  // Visningskilde for listene. velgDokumentVisning bevarer online-spinner (Q5) og faller
  // til lokalt uten nett/feilet/pauset (samme pause-regel som fase 2, 255c739c).
  const brukServerListe = sjekklisteQuery.isSuccess && oppgaveQuery.isSuccess;
  const { offlineModus: innboksFrakoblet } = velgDokumentVisning({
    erPaaNettet,
    serverBekreftet: brukServerListe,
    erFeilet: sjekklisteQuery.isError || oppgaveQuery.isError,
    erPauset: sjekklisteQuery.fetchStatus === "paused" || oppgaveQuery.fetchStatus === "paused",
    harSpeil: lokaleSjekklister.length + lokaleOppgaver.length > 0,
  });

  // Innboksen er STATUS-avledet (sent/received/in_progress) på dokumenter brukeren ser —
  // den beregner ikke «hvem har ballen» per mottaker, bare dokumentets status. De lokale
  // katalogene bærer status og er bruker-scopet, så det aktive settet rekonstrueres fullt
  // offline. Derfor VISES innboksen lokalt (skjules ikke) når speilet finnes — jf. ordren.
  const innboksElementer = useMemo(() => {
    const aktiv = (status: string) => AKTIVE_STATUSER.includes(status);
    let elementer: InnboksElement[] = [];
    if (brukServerListe) {
      elementer = [
        ...(sjekklister ?? []).filter((s) => aktiv(s.status)).map((s) => ({
          id: s.id, type: "sjekkliste" as const, tittel: s.title,
          nummer: formaterNummer(s.template?.prefix, s.number),
          undertekst: s.template?.name ?? "", bygning: s.byggeplass?.name ?? null,
          tidspunkt: s.updatedAt, status: s.status,
        })),
        ...(oppgaver ?? []).filter((o) => aktiv(o.status)).map((o) => ({
          id: o.id, type: "oppgave" as const, tittel: o.title,
          nummer: formaterNummer(o.template?.prefix, o.number),
          undertekst: PRIORITETS_NOEKLER[o.priority] ? t(PRIORITETS_NOEKLER[o.priority]) : o.priority,
          bygning: null, tidspunkt: o.updatedAt, status: o.status,
        })),
      ];
    } else if (innboksFrakoblet) {
      // Lokale katalog-rader har samme template/byggeplass-objektform som serverradene.
      elementer = [
        ...lokaleSjekklister.filter((s) => aktiv(s.status)).map((s) => ({
          id: s.id, type: "sjekkliste" as const, tittel: s.title,
          nummer: formaterNummer(s.template?.prefix, s.number),
          undertekst: s.template?.name ?? "", bygning: s.byggeplass?.name ?? null,
          tidspunkt: s.updatedAt, status: s.status,
        })),
        ...lokaleOppgaver.filter((o) => aktiv(o.status)).map((o) => ({
          id: o.id, type: "oppgave" as const, tittel: o.title,
          nummer: formaterNummer(o.template?.prefix, o.number),
          undertekst: PRIORITETS_NOEKLER[o.priority] ? t(PRIORITETS_NOEKLER[o.priority]) : o.priority,
          bygning: null, tidspunkt: o.updatedAt, status: o.status,
        })),
      ];
    }
    elementer.sort((a, b) => new Date(b.tidspunkt).getTime() - new Date(a.tidspunkt).getTime());
    return elementer;
    // `t` MÅ være med: undertekst bygges via t(PRIORITETS_NOEKLER[...]) i memo-en.
  }, [brukServerListe, innboksFrakoblet, sjekklister, oppgaver, lokaleSjekklister, lokaleOppgaver, t]);

  const innboksAntall = innboksElementer.length;
  const totaleOppgaver = brukServerListe ? (oppgaver?.length ?? 0) : innboksFrakoblet ? lokaleOppgaver.length : 0;
  const totaleSjekklister = brukServerListe ? (sjekklister?.length ?? 0) : innboksFrakoblet ? lokaleSjekklister.length : 0;
  // Offline uten nok lokale data → vis én linje i stedet for innboks (ikke en feilside).
  const innboksKreverNett = !brukServerListe && !innboksFrakoblet && !erPaaNettet;

  // Sist oppdatert timestamp
  const sistOppdatert = Math.max(
    sjekklisteQuery.dataUpdatedAt || 0,
    oppgaveQuery.dataUpdatedAt || 0,
  );

  // Pull-to-refresh
  const erRefreshing =
    sjekklisteQuery.isRefetching || oppgaveQuery.isRefetching;

  const onRefresh = useCallback(() => {
    // Invalidér alle queries — sikrer at arbeidsforløp, maler, faggrupper osv. også oppdateres
    queryClient.invalidateQueries();
  }, [queryClient]);

  const håndterPluss = useCallback(() => {
    if (!valgtProsjektId) return;
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [t("hjem.nySjekkliste"), t("hjem.nyOppgave"), t("handling.avbryt")],
          cancelButtonIndex: 2,
        },
        (indeks) => {
          if (indeks === 0) setOpprettKategori("sjekkliste");
          else if (indeks === 1) setOpprettKategori("oppgave");
        },
      );
    } else {
      setVisAndroidMeny(true);
    }
  }, [valgtProsjektId]);

  const håndterOpprettet = useCallback(
    (id: string) => {
      const kat = opprettKategori;
      setOpprettKategori(null);
      if (valgtProsjektId) {
        utils.sjekkliste.hentForProsjekt.invalidate({ projectId: valgtProsjektId });
        utils.oppgave.hentForProsjekt.invalidate({ projectId: valgtProsjektId });
      }
      if (kat === "sjekkliste") {
        router.push(`/sjekkliste/${id}`);
      } else if (kat === "oppgave") {
        router.push(`/oppgave/${id}`);
      }
    },
    [valgtProsjektId, opprettKategori, utils, router],
  );

  // Innholds-spinner KUN online mens vi faktisk venter på server (online-atferd uendret).
  // Offline faller vi aldri hit — da vises lokal innboks + seksjonslenker, ingen spinner.
  const lasterData =
    !!valgtProsjektId && erPaaNettet && !brukServerListe &&
    (sjekklisteQuery.isLoading || oppgaveQuery.isLoading);

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      {/* Gronn header med prosjektvelger */}
      <View className="flex-row items-center justify-between bg-sitedoc-blue px-4 py-3">
        <Pressable
          onPress={() => setVelgerSynlig(true)}
          className="flex-row items-center gap-2"
        >
          <View className="h-2.5 w-2.5 rounded-full bg-blue-300" />
          <View>
            <Text className="text-lg font-semibold text-white" numberOfLines={1}>
              {valgtProsjekt?.name ?? t("hjem.velgProsjektKnapp")}
            </Text>
          </View>
          <ChevronDown size={20} color="#ffffff" />
        </Pressable>
        <Pressable onPress={håndterPluss} className="rounded-full bg-white/20 p-2">
          <Plus size={20} color="#ffffff" />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-8"
        refreshControl={
          <RefreshControl refreshing={erRefreshing} onRefresh={onRefresh} />
        }
      >
        {/* F2: global byggeplass-chip — synlig på alle relevante skjermer */}
        <ByggeplassChip />

        {/* P3-hybrid: kompakt timer-chip (3 tilstander). Det fulle «Start dag/
            Slutt dag»-kortet bor nå på timer-flaten (DagsseddelListe). */}
        <HjemTimerChip />

        {/* §15-innsjekk/utsjekk på byggeplass (online-only, vy i PSI-modulen) */}
        {erPsiAktiv && <MannskapInnsjekkKort />}

        {firmaer.length > 1 && !valgtFirmaId && (
          <Pressable
            onPress={() => setVisFirmaVelger(true)}
            className="mx-4 mt-3 flex-row items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"
          >
            <Building2 size={20} color="#d97706" />
            <View className="flex-1">
              <Text className="text-sm font-semibold text-amber-900">
                {t("hjem.velgFirma")}
              </Text>
              <Text className="mt-0.5 text-xs text-amber-700">
                {t("hjem.velgFirmaUndertekst")}
              </Text>
            </View>
            <ChevronRight size={18} color="#d97706" />
          </Pressable>
        )}
        {prosjektVisning === "spinner" ? (
          /* Laster prosjekter (online, venter på server) */
          <View className="items-center pt-20">
            <ActivityIndicator size="large" color="#1e40af" />
            <Text className="mt-3 text-sm text-gray-500">
              {t("hjem.henterProsjekter")}
            </Text>
          </View>
        ) : prosjektVisning === "feil" ? (
          /* Feilside — på nett og spørringen feiler, eller uten nett og ingen lokale prosjekter. */
          <View className="flex-1 items-center justify-center px-6 pt-20">
            <AlertTriangle size={40} color="#f59e0b" />
            <Text className="mt-4 text-center text-base font-medium text-gray-900">
              {t("hjem.kunneIkkeHenteProsjekter")}
            </Text>
            <Text className="mt-2 text-center text-sm text-gray-500">
              {prosjektFeilmelding ?? t("feil.sjekkNettverk")}
            </Text>
            <Pressable
              onPress={refetchProsjekt}
              className="mt-4 flex-row items-center gap-2 rounded-lg bg-blue-600 px-6 py-3"
            >
              <RefreshCw size={16} color="#ffffff" />
              <Text className="font-medium text-white">{t("handling.provIgjen")}</Text>
            </Pressable>
          </View>
        ) : !valgtProsjektId ? (
          /* Ingen prosjekt valgt */
          <View className="flex-1 items-center justify-center px-4 pt-20">
            {prosjektListe.length === 0 ? (
              <Text className="text-center text-base text-gray-500">
                {t("hjem.registrerPaaSitedoc")}
              </Text>
            ) : (
              <>
                <Text className="text-center text-base text-gray-500">
                  {t("hjem.velgProsjekt")}
                </Text>
                <Pressable
                  onPress={() => setVelgerSynlig(true)}
                  className="mt-4 rounded-lg bg-blue-600 px-6 py-3"
                >
                  <Text className="font-medium text-white">{t("hjem.velgProsjektKnapp")}</Text>
                </Pressable>
              </>
            )}
          </View>
        ) : lasterData ? (
          /* Laster data (online) */
          <View className="items-center pt-20">
            <ActivityIndicator size="large" color="#1e40af" />
            <Text className="mt-3 text-sm text-gray-500">
              {t("hjem.henterData")}
            </Text>
          </View>
        ) : (
          <>
            {/* Frakoblet-banner — samme amber-linje som listeskjermene. Vises når prosjektet
                og/eller innboksen leses fra lokal cache (uten nett / feilet / pauset). */}
            {(prosjektFrakoblet || innboksFrakoblet) && (
              <View className="flex-row items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2">
                <WifiOff size={14} color="#b45309" />
                <Text className="flex-1 text-xs text-amber-800">
                  {t("offline.frakobletLagret")}
                </Text>
              </View>
            )}

            {/* PSI-statuskort (over innboks) — online-vy (hentForProsjekt/hentMinStatus). */}
            {erPsiAktiv && psiListe.length > 0 && (
              <PsiStatusKort psiListe={psiListe} />
            )}

            {/* Innboks-seksjon. Ren tekst-header, ikke Pressable: «innboksen» er
                ingen egen rute — den er den avledede lista rett under (aktive
                sjekklister + oppgaver). Radene navigerer hver for seg, «Se alle»
                folder ut inline. En chevron her lovet en destinasjon som ikke
                finnes. */}
            <View className="flex-row items-center gap-2 border-b border-gray-200 bg-white px-4 py-3">
              <Text className="text-base font-semibold text-gray-900">
                {t("hjem.innboks")}
              </Text>
              <View className="rounded-full bg-gray-100 px-2 py-0.5">
                <Text className="text-xs font-medium text-gray-600">
                  {innboksAntall}
                </Text>
              </View>
            </View>

            {/* Innbokselementer. Uten nett og uten lokale data: én linje «Innboksen krever
                nett» (ikke en feilside) — se leveranse for begrunnelse. */}
            {innboksElementer.length === 0 ? (
              <View className="border-b border-gray-200 bg-white px-4 py-6">
                <Text className="text-center text-sm text-gray-400">
                  {innboksKreverNett ? t("hjem.innboksKreverNett") : t("hjem.ingenInnboks")}
                </Text>
              </View>
            ) : (
              <>
                {/* Fabel C: maks 3 innboksrader inline så Oppgaver/Sjekklister/
                    Kontrollplaner/HMS-seksjonene holder seg over skjermkanten.
                    «Se alle» navigerer til /innboks (hele den aktive lista med
                    søk/filter/sortering) — ikke lenger en inline-toggle med
                    hardt tak på 10. Badge over = totalantall. */}
                {innboksElementer
                  .slice(0, INNBOKS_MAKS)
                  .map((element) => (
                  <Pressable
                    key={element.id}
                    className="flex-row items-center border-b border-gray-100 bg-white px-4 py-3"
                    onPress={() => {
                      if (element.type === "sjekkliste") {
                        router.push(`/sjekkliste/${element.id}`);
                      } else if (element.type === "oppgave") {
                        router.push(`/oppgave/${element.id}`);
                      }
                    }}
                  >
                    <View className="mr-3">
                      {element.type === "sjekkliste" ? (
                        <ClipboardCheck size={18} color="#6b7280" />
                      ) : (
                        <ListTodo size={18} color="#6b7280" />
                      )}
                    </View>
                    <View className="flex-1">
                      <Text
                        className="text-sm text-gray-900"
                        numberOfLines={1}
                      >
                        {element.nummer ? <Text className="font-bold">{element.nummer} </Text> : null}{element.tittel}
                      </Text>
                      <Text className="text-xs text-gray-500" numberOfLines={1}>
                        {element.undertekst}
                        {element.bygning ? ` · ${element.bygning}` : ""}
                        {(element.undertekst || element.bygning) ? " · " : ""}
                        {formaterTidspunkt(element.tidspunkt, t)}
                      </Text>
                    </View>
                  </Pressable>
                ))}
                {innboksElementer.length > INNBOKS_MAKS && (
                  <Pressable
                    className="flex-row items-center justify-between border-b border-gray-200 bg-white px-4 py-3"
                    onPress={() => router.push("/innboks")}
                  >
                    <Text className="text-sm font-medium text-sitedoc-blue">
                      {t("hjem.seAlleInnboks", { antall: innboksElementer.length })}
                    </Text>
                    <ChevronRight size={18} color="#1e40af" />
                  </Pressable>
                )}
              </>
            )}

            {/* Seksjonslenker */}
            <View className="mt-4">
              <Pressable
                onPress={() => router.push("/oppgave")}
                className="flex-row items-center justify-between border-b border-gray-200 bg-white px-4 py-3"
              >
                <View className="flex-row items-center gap-2">
                  <Text className="text-base font-semibold text-gray-900">
                    {t("hjem.oppgaver")}
                  </Text>
                  {totaleOppgaver > 0 && (
                    <View className="rounded-full bg-gray-100 px-2 py-0.5">
                      <Text className="text-xs font-medium text-gray-600">
                        {totaleOppgaver}
                      </Text>
                    </View>
                  )}
                </View>
                <ChevronRight size={20} color="#9ca3af" />
              </Pressable>

              <Pressable
                onPress={() => router.push("/sjekkliste")}
                className="flex-row items-center justify-between border-b border-gray-200 bg-white px-4 py-3"
              >
                <View className="flex-row items-center gap-2">
                  <Text className="text-base font-semibold text-gray-900">
                    {t("hjem.sjekklister")}
                  </Text>
                  {totaleSjekklister > 0 && (
                    <View className="rounded-full bg-gray-100 px-2 py-0.5">
                      <Text className="text-xs font-medium text-gray-600">
                        {totaleSjekklister}
                      </Text>
                    </View>
                  )}
                </View>
                <ChevronRight size={20} color="#9ca3af" />
              </Pressable>

              <Pressable
                onPress={() => router.push("/kontrollplan")}
                className="flex-row items-center justify-between border-b border-gray-200 bg-white px-4 py-3"
              >
                <Text className="text-base font-semibold text-gray-900">
                  {t("hjem.kontrollplaner")}
                </Text>
                <ChevronRight size={20} color="#9ca3af" />
              </Pressable>

              <Pressable
                onPress={() => router.push("/hms")}
                className="flex-row items-center justify-between border-b border-gray-200 bg-white px-4 py-3"
              >
                <Text className="text-base font-semibold text-gray-900">
                  {t("hjem.hms")}
                </Text>
                <ChevronRight size={20} color="#9ca3af" />
              </Pressable>

              {harIfcModeller && (
              <Pressable
                onPress={() => router.push("/3d-visning")}
                className="flex-row items-center justify-between border-b border-gray-200 bg-white px-4 py-3"
              >
                <Text className="text-base font-semibold text-gray-900">
                  {t("hjem.3dVisning")}
                </Text>
                <ChevronRight size={20} color="#9ca3af" />
              </Pressable>
              )}

              {harIfcModeller && (
              <Pressable
                onPress={() => router.push("/live-view")}
                className="flex-row items-center justify-between border-b border-gray-200 bg-white px-4 py-3"
              >
                <Text className="text-base font-semibold text-gray-900">
                  {t("hjem.liveView")}
                </Text>
                <ChevronRight size={20} color="#9ca3af" />
              </Pressable>
              )}

              {harIfcModeller && (
              <Pressable
                onPress={() => router.push("/tegning-3d")}
                className="flex-row items-center justify-between border-b border-gray-200 bg-white px-4 py-3"
              >
                <Text className="text-base font-semibold text-gray-900">
                  {t("hjem.tegning3d")}
                </Text>
                <ChevronRight size={20} color="#9ca3af" />
              </Pressable>
              )}

            </View>

            {/* Sist oppdatert */}
            {sistOppdatert > 0 && (
              <View className="mt-6 px-4">
                <Text className="text-center text-xs text-gray-400">
                  {t("hjem.oppdatert", { tid: formaterSistOppdatert(sistOppdatert) })}
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Prosjektvelger-modal */}
      <ProsjektVelger
        synlig={velgerSynlig}
        onLukk={() => setVelgerSynlig(false)}
      />

      {/* Firma-velger-modal */}
      <FirmaVelger synlig={visFirmaVelger} onLukk={() => setVisFirmaVelger(false)} />

      {/* Android-meny for opprettelse */}
      <RNModal
        visible={visAndroidMeny}
        transparent
        animationType="fade"
        onRequestClose={() => setVisAndroidMeny(false)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/40"
          onPress={() => setVisAndroidMeny(false)}
        >
          <View className="rounded-t-2xl bg-white pb-8 pt-4">
            <Pressable
              onPress={() => {
                setVisAndroidMeny(false);
                setOpprettKategori("sjekkliste");
              }}
              className="px-6 py-4"
            >
              <Text className="text-base font-medium text-gray-900">{t("hjem.nySjekkliste")}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setVisAndroidMeny(false);
                setOpprettKategori("oppgave");
              }}
              className="px-6 py-4"
            >
              <Text className="text-base font-medium text-gray-900">{t("hjem.nyOppgave")}</Text>
            </Pressable>
            <Pressable
              onPress={() => setVisAndroidMeny(false)}
              className="px-6 py-4"
            >
              <Text className="text-base text-gray-500">{t("handling.avbryt")}</Text>
            </Pressable>
          </View>
        </Pressable>
      </RNModal>

      {/* Gruppert opprett-velger — oppretter direkte (server utleder faggruppe). */}
      <OpprettVelger
        synlig={!!opprettKategori}
        kategori={opprettKategori ?? "sjekkliste"}
        onOpprettet={håndterOpprettet}
        onLukk={() => setOpprettKategori(null)}
      />
    </SafeAreaView>
  );
}

/* PSI-statuslinje — smal linje per PSI */
function PsiStatusKort({ psiListe }: { psiListe: Array<{ id: string; version: number; byggeplassId: string | null; byggeplass: { id: string; name: string } | null; template: { id: string; name: string; prefix: string | null } }> }) {
  const router = useRouter();

  return (
    <View className="mt-2">
      {psiListe.map((psi) => (
        <PsiStatusRad key={psi.id} psi={psi} onPress={() => router.push(`/psi/${psi.id}`)} />
      ))}
    </View>
  );
}

function PsiStatusRad({ psi, onPress }: {
  psi: { id: string; version: number; byggeplassId: string | null; byggeplass: { id: string; name: string } | null };
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const statusQuery = trpc.psi.hentMinStatus.useQuery({ psiId: psi.id });
  const status = statusQuery.data;
  const navn = psi.byggeplass?.name ?? null;

  let bakgrunn = "bg-amber-50";
  let ikon = "#f59e0b";
  let tekst = t("psi.signeringKreves");
  let tekstFarge = "text-amber-700";

  if (status?.signert && !status.utdatert) {
    bakgrunn = "bg-green-50";
    ikon = "#10b981";
    tekst = t("hjem.psiSignert");
    tekstFarge = "text-green-700";
  } else if (status?.utdatert) {
    bakgrunn = "bg-red-50";
    ikon = "#ef4444";
    tekst = t("hjem.psiNySignering");
    tekstFarge = "text-red-600";
  }

  return (
    <Pressable onPress={onPress} className={`flex-row items-center border-b border-gray-100 ${bakgrunn} px-4 py-2.5`}>
      <ShieldCheck size={16} color={ikon} />
      <Text className={`ml-2 flex-1 text-xs font-medium ${tekstFarge}`} numberOfLines={1}>
        {tekst}{navn ? ` — ${navn}` : ""}
      </Text>
      <ChevronRight size={14} color="#9ca3af" />
    </Pressable>
  );
}
