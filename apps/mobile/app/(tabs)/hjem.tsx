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
} from "lucide-react-native";
import { useQueryClient } from "@tanstack/react-query";
import { trpc } from "../../src/lib/trpc";
import { useProsjekt } from "../../src/kontekst/ProsjektKontekst";
import { useBygning } from "../../src/kontekst/BygningKontekst";
import { ProsjektVelger } from "../../src/components/ProsjektVelger";
import { MalVelger } from "../../src/components/MalVelger";
import { OpprettDokumentModal } from "../../src/components/OpprettDokumentModal";

const AKTIVE_STATUSER = ["sent", "received", "in_progress"];

interface MalData {
  id: string;
  name: string;
  prefix: string | null;
  category: string;
  subjects?: string[];
}

interface InnboksElement {
  id: string;
  type: "sjekkliste" | "oppgave";
  tittel: string;
  nummer: string | null;
  undertekst: string;
  tidspunkt: Date | string;
  status: string;
}

function formaterTidspunkt(dato: Date | string): string {
  const d = new Date(dato);
  const na = new Date();
  const diffMs = na.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffTimer = Math.floor(diffMs / 3600000);
  const diffDager = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "Akkurat nå";
  if (diffMin < 60) return `${diffMin} min siden`;
  if (diffTimer < 24) return `${diffTimer} t siden`;
  if (diffDager < 7) return `${diffDager} d siden`;
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

const PRIORITETS_TEKST: Record<string, string> = {
  low: "Lav prioritet",
  medium: "Medium prioritet",
  high: "Hoy prioritet",
  critical: "Kritisk",
};

function formaterNummer(prefix: string | null | undefined, nummer: number | null | undefined): string | null {
  if (!prefix || nummer == null) return null;
  return `${prefix}${nummer}`;
}

export default function HjemSkjerm() {
  const { valgtProsjektId } = useProsjekt();
  const { valgtBygningId } = useBygning();
  const [velgerSynlig, setVelgerSynlig] = useState(false);
  const [opprettKategori, setOpprettKategori] = useState<"sjekkliste" | "oppgave" | null>(null);
  const [valgtMal, setValgtMal] = useState<MalData | null>(null);
  const [visAndroidMeny, setVisAndroidMeny] = useState(false);
  const router = useRouter();
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();

  // Hent prosjektdata for valgt prosjekt
  const prosjektQuery = trpc.prosjekt.hentMine.useQuery();
  const valgtProsjekt = prosjektQuery.data?.find(
    (p) => p.id === valgtProsjektId,
  );

  // Hent bygninger for å vise valgt bygningsnavn
  const bygningQuery = trpc.bygning.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId },
  );
  const bygninger = bygningQuery.data as Array<{ id: string; name: string; drawings?: Array<{ fileType?: string | null }> }> | undefined;

  const valgtBygningNavn = useMemo(() => {
    if (!valgtBygningId || !bygninger) return null;
    return bygninger.find((b) => b.id === valgtBygningId)?.name ?? null;
  }, [valgtBygningId, bygninger]);

  // Sjekk om valgt bygning har IFC-modeller
  const harIfcModeller = useMemo(() => {
    if (!valgtBygningId || !bygninger) return false;
    const bygning = bygninger.find((b) => b.id === valgtBygningId);
    return bygning?.drawings?.some((d) => d.fileType?.toLowerCase() === "ifc") ?? false;
  }, [valgtBygningId, bygninger]);

  // Hent sjekklister og oppgaver for valgt prosjekt (filtrert på bygning)
  const sjekklisteQuery = trpc.sjekkliste.hentForProsjekt.useQuery(
    {
      projectId: valgtProsjektId!,
      ...(valgtBygningId ? { buildingId: valgtBygningId } : {}),
    },
    { enabled: !!valgtProsjektId },
  );

  const oppgaveQuery = trpc.oppgave.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId },
  );

  // Cast tRPC-data for å unngå TS2589 (excessively deep type instantiation)
  const sjekklister = sjekklisteQuery.data as
    | Array<{ id: string; title: string; status: string; number?: number | null; updatedAt: Date | string; template?: { name: string; prefix?: string | null } | null }>
    | undefined;

  const oppgaver = oppgaveQuery.data as
    | Array<{ id: string; title: string; status: string; priority: string; number?: number | null; updatedAt: Date | string; template?: { name: string; prefix?: string | null } | null }>
    | undefined;

  // Filtrer aktive elementer for innboksen
  const aktiveSjekklister = useMemo(
    () => sjekklister?.filter((s) => AKTIVE_STATUSER.includes(s.status)) ?? [],
    [sjekklister],
  );

  const aktiveOppgaver = useMemo(
    () => oppgaver?.filter((o) => AKTIVE_STATUSER.includes(o.status)) ?? [],
    [oppgaver],
  );

  const innboksAntall = aktiveSjekklister.length + aktiveOppgaver.length;
  const totaleOppgaver = oppgaver?.length ?? 0;
  const totaleSjekklister = sjekklister?.length ?? 0;

  // Kombiner og sorter innbokselementer etter sist oppdatert
  const innboksElementer = useMemo(() => {
    const elementer: InnboksElement[] = [
      ...aktiveSjekklister.map((s) => ({
        id: s.id,
        type: "sjekkliste" as const,
        tittel: s.title,
        nummer: formaterNummer(s.template?.prefix, s.number),
        undertekst: s.template?.name ?? "",
        tidspunkt: s.updatedAt,
        status: s.status,
      })),
      ...aktiveOppgaver.map((o) => ({
        id: o.id,
        type: "oppgave" as const,
        tittel: o.title,
        nummer: formaterNummer(o.template?.prefix, o.number),
        undertekst: PRIORITETS_TEKST[o.priority] ?? o.priority,
        tidspunkt: o.updatedAt,
        status: o.status,
      })),
    ];
    elementer.sort(
      (a, b) =>
        new Date(b.tidspunkt).getTime() - new Date(a.tidspunkt).getTime(),
    );
    return elementer;
  }, [aktiveSjekklister, aktiveOppgaver]);

  // Sist oppdatert timestamp
  const sistOppdatert = Math.max(
    sjekklisteQuery.dataUpdatedAt || 0,
    oppgaveQuery.dataUpdatedAt || 0,
  );

  // Pull-to-refresh
  const erRefreshing =
    sjekklisteQuery.isRefetching || oppgaveQuery.isRefetching;

  const onRefresh = useCallback(() => {
    // Invalidér alle queries — sikrer at arbeidsforløp, maler, entrepriser osv. også oppdateres
    queryClient.invalidateQueries();
  }, [queryClient]);

  const håndterPluss = useCallback(() => {
    if (!valgtProsjektId) return;
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Ny sjekkliste", "Ny oppgave", "Avbryt"],
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
      setValgtMal(null);
      setOpprettKategori(null);
      // Invalidér queries for å oppdatere listene
      if (valgtProsjektId) {
        utils.sjekkliste.hentForProsjekt.invalidate({ projectId: valgtProsjektId });
        utils.oppgave.hentForProsjekt.invalidate({ projectId: valgtProsjektId });
      }
      if (opprettKategori === "sjekkliste") {
        router.push(`/sjekkliste/${id}`);
      } else if (opprettKategori === "oppgave") {
        router.push(`/oppgave/${id}`);
      }
    },
    [valgtProsjektId, opprettKategori, utils, router],
  );

  const lasterData =
    valgtProsjektId &&
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
              {valgtProsjekt?.name ?? "Velg prosjekt"}
            </Text>
            {valgtBygningNavn && (
              <Text className="text-[10px] text-blue-200" numberOfLines={1}>
                {valgtBygningNavn}
              </Text>
            )}
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
        {prosjektQuery.isLoading ? (
          /* Laster prosjekter */
          <View className="items-center pt-20">
            <ActivityIndicator size="large" color="#1e40af" />
            <Text className="mt-3 text-sm text-gray-500">
              Henter prosjekter...
            </Text>
          </View>
        ) : prosjektQuery.isError ? (
          /* Feil ved lasting av prosjekter */
          <View className="flex-1 items-center justify-center px-6 pt-20">
            <AlertTriangle size={40} color="#f59e0b" />
            <Text className="mt-4 text-center text-base font-medium text-gray-900">
              Kunne ikke hente prosjekter
            </Text>
            <Text className="mt-2 text-center text-sm text-gray-500">
              {prosjektQuery.error?.message ?? "Sjekk nettverkstilkoblingen og prøv igjen"}
            </Text>
            <Pressable
              onPress={() => prosjektQuery.refetch()}
              className="mt-4 flex-row items-center gap-2 rounded-lg bg-blue-600 px-6 py-3"
            >
              <RefreshCw size={16} color="#ffffff" />
              <Text className="font-medium text-white">Prøv igjen</Text>
            </Pressable>
          </View>
        ) : !valgtProsjektId ? (
          /* Ingen prosjekt valgt */
          <View className="flex-1 items-center justify-center px-4 pt-20">
            {prosjektQuery.data && prosjektQuery.data.length === 0 ? (
              <Text className="text-center text-base text-gray-500">
                Du kan logge inn på sitedoc.no og registrere nytt prosjekt
              </Text>
            ) : (
              <>
                <Text className="text-center text-base text-gray-500">
                  Velg et prosjekt for å komme i gang
                </Text>
                <Pressable
                  onPress={() => setVelgerSynlig(true)}
                  className="mt-4 rounded-lg bg-blue-600 px-6 py-3"
                >
                  <Text className="font-medium text-white">Velg prosjekt</Text>
                </Pressable>
              </>
            )}
          </View>
        ) : lasterData ? (
          /* Laster data */
          <View className="items-center pt-20">
            <ActivityIndicator size="large" color="#1e40af" />
            <Text className="mt-3 text-sm text-gray-500">
              Henter data...
            </Text>
          </View>
        ) : (sjekklisteQuery.isError || oppgaveQuery.isError) ? (
          /* Feil ved lasting av sjekklister/oppgaver */
          <View className="flex-1 items-center justify-center px-6 pt-20">
            <AlertTriangle size={40} color="#f59e0b" />
            <Text className="mt-4 text-center text-base font-medium text-gray-900">
              Kunne ikke hente data
            </Text>
            <Text className="mt-2 text-center text-sm text-gray-500">
              {sjekklisteQuery.error?.message ?? oppgaveQuery.error?.message ?? "Sjekk nettverkstilkoblingen"}
            </Text>
            <Pressable
              onPress={onRefresh}
              className="mt-4 flex-row items-center gap-2 rounded-lg bg-blue-600 px-6 py-3"
            >
              <RefreshCw size={16} color="#ffffff" />
              <Text className="font-medium text-white">Prøv igjen</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Innboks-seksjon */}
            <Pressable className="flex-row items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
              <View className="flex-row items-center gap-2">
                <Text className="text-base font-semibold text-gray-900">
                  Innboks
                </Text>
                <View className="rounded-full bg-gray-100 px-2 py-0.5">
                  <Text className="text-xs font-medium text-gray-600">
                    {innboksAntall}
                  </Text>
                </View>
              </View>
              <ChevronRight size={20} color="#9ca3af" />
            </Pressable>

            {/* Innbokselementer */}
            {innboksElementer.length === 0 ? (
              <View className="border-b border-gray-200 bg-white px-4 py-6">
                <Text className="text-center text-sm text-gray-400">
                  Ingen aktive elementer i innboksen
                </Text>
              </View>
            ) : (
              innboksElementer.slice(0, 10).map((element) => (
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
                      {element.undertekst ? " · " : ""}
                      {formaterTidspunkt(element.tidspunkt)}
                    </Text>
                  </View>
                </Pressable>
              ))
            )}

            {/* Seksjonslenker */}
            <View className="mt-4">
              <Pressable
                onPress={() => router.push("/oppgave")}
                className="flex-row items-center justify-between border-b border-gray-200 bg-white px-4 py-3"
              >
                <View className="flex-row items-center gap-2">
                  <Text className="text-base font-semibold text-gray-900">
                    Oppgaver
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
                    Sjekklister
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

              <Pressable className="flex-row items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
                <Text className="text-base font-semibold text-gray-900">
                  Kontrollplaner
                </Text>
                <ChevronRight size={20} color="#9ca3af" />
              </Pressable>

              {harIfcModeller && (
              <Pressable
                onPress={() => router.push("/3d-visning")}
                className="flex-row items-center justify-between border-b border-gray-200 bg-white px-4 py-3"
              >
                <Text className="text-base font-semibold text-gray-900">
                  3D-visning
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
                  Live View
                </Text>
                <ChevronRight size={20} color="#9ca3af" />
              </Pressable>
              )}
            </View>

            {/* Sist oppdatert */}
            {sistOppdatert > 0 && (
              <View className="mt-6 px-4">
                <Text className="text-center text-xs text-gray-400">
                  Oppdatert {formaterSistOppdatert(sistOppdatert)}
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
              <Text className="text-base font-medium text-gray-900">Ny sjekkliste</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setVisAndroidMeny(false);
                setOpprettKategori("oppgave");
              }}
              className="px-6 py-4"
            >
              <Text className="text-base font-medium text-gray-900">Ny oppgave</Text>
            </Pressable>
            <Pressable
              onPress={() => setVisAndroidMeny(false)}
              className="px-6 py-4"
            >
              <Text className="text-base text-gray-500">Avbryt</Text>
            </Pressable>
          </View>
        </Pressable>
      </RNModal>

      {/* Malvelger-modal */}
      <MalVelger
        synlig={!!opprettKategori && !valgtMal}
        kategori={opprettKategori ?? "sjekkliste"}
        onVelg={(mal) => setValgtMal(mal)}
        onLukk={() => setOpprettKategori(null)}
      />

      {/* Opprett dokument-modal */}
      <OpprettDokumentModal
        synlig={!!opprettKategori && !!valgtMal}
        kategori={opprettKategori ?? "sjekkliste"}
        mal={valgtMal ?? { id: "", name: "", prefix: null, category: "" }}
        onOpprettet={håndterOpprettet}
        onLukk={() => {
          setValgtMal(null);
          setOpprettKategori(null);
        }}
      />
    </SafeAreaView>
  );
}
