import { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  ClipboardCheck,
  ListTodo,
} from "lucide-react-native";
import { trpc } from "../../src/lib/trpc";
import { useProsjekt } from "../../src/kontekst/ProsjektKontekst";
import { ProsjektVelger } from "../../src/components/ProsjektVelger";

const AKTIVE_STATUSER = ["sent", "received", "in_progress"];

interface InnboksElement {
  id: string;
  type: "sjekkliste" | "oppgave";
  tittel: string;
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

export default function HjemSkjerm() {
  const { valgtProsjektId } = useProsjekt();
  const [velgerSynlig, setVelgerSynlig] = useState(false);
  const router = useRouter();

  // Hent prosjektdata for valgt prosjekt
  const prosjektQuery = trpc.prosjekt.hentMine.useQuery();
  const valgtProsjekt = prosjektQuery.data?.find(
    (p) => p.id === valgtProsjektId,
  );

  // Hent sjekklister og oppgaver for valgt prosjekt
  const sjekklisteQuery = trpc.sjekkliste.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId },
  );

  const oppgaveQuery = trpc.oppgave.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId },
  );

  // Cast tRPC-data for å unngå TS2589 (excessively deep type instantiation)
  const sjekklister = sjekklisteQuery.data as
    | Array<{ id: string; title: string; status: string; updatedAt: Date | string; template?: { name: string } | null }>
    | undefined;

  const oppgaver = oppgaveQuery.data as
    | Array<{ id: string; title: string; status: string; priority: string; updatedAt: Date | string }>
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
  const totaleSjekklister = sjekklister?.length ?? 0;

  // Kombiner og sorter innbokselementer etter sist oppdatert
  const innboksElementer = useMemo(() => {
    const elementer: InnboksElement[] = [
      ...aktiveSjekklister.map((s) => ({
        id: s.id,
        type: "sjekkliste" as const,
        tittel: s.title,
        undertekst: s.template?.name ?? "",
        tidspunkt: s.updatedAt,
        status: s.status,
      })),
      ...aktiveOppgaver.map((o) => ({
        id: o.id,
        type: "oppgave" as const,
        tittel: o.title,
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
    prosjektQuery.refetch();
    if (valgtProsjektId) {
      sjekklisteQuery.refetch();
      oppgaveQuery.refetch();
    }
  }, [valgtProsjektId, prosjektQuery, sjekklisteQuery, oppgaveQuery]);

  const lasterData =
    valgtProsjektId &&
    (sjekklisteQuery.isLoading || oppgaveQuery.isLoading);

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      {/* Gronn header med prosjektvelger */}
      <View className="flex-row items-center justify-between bg-siteflow-blue px-4 py-3">
        <Pressable
          onPress={() => setVelgerSynlig(true)}
          className="flex-row items-center gap-2"
        >
          <View className="h-2.5 w-2.5 rounded-full bg-blue-300" />
          <Text className="text-lg font-semibold text-white" numberOfLines={1}>
            {valgtProsjekt?.name ?? "Velg prosjekt"}
          </Text>
          <ChevronDown size={20} color="#ffffff" />
        </Pressable>
        <Pressable className="rounded-full bg-white/20 p-2">
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
        {!valgtProsjektId ? (
          /* Ingen prosjekt valgt */
          <View className="flex-1 items-center justify-center px-4 pt-20">
            <Text className="text-center text-base text-gray-500">
              Velg et prosjekt for aa komme i gang
            </Text>
            <Pressable
              onPress={() => setVelgerSynlig(true)}
              className="mt-4 rounded-lg bg-blue-600 px-6 py-3"
            >
              <Text className="font-medium text-white">Velg prosjekt</Text>
            </Pressable>
          </View>
        ) : lasterData ? (
          /* Laster data */
          <View className="items-center pt-20">
            <ActivityIndicator size="large" color="#1e40af" />
            <Text className="mt-3 text-sm text-gray-500">
              Henter data...
            </Text>
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
                      className="text-sm font-medium text-gray-900"
                      numberOfLines={1}
                    >
                      {element.tittel}
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
              <Pressable className="flex-row items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
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
    </SafeAreaView>
  );
}
