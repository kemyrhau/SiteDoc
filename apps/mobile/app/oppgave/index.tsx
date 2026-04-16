import { useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useQueryClient } from "@tanstack/react-query";
import { trpc } from "../../src/lib/trpc";
import { useProsjekt } from "../../src/kontekst/ProsjektKontekst";
import { StatusMerkelapp } from "../../src/components/StatusMerkelapp";

const PRIORITETS_TEKST: Record<string, string> = {
  low: "Lav",
  medium: "Medium",
  high: "Høy",
  critical: "Kritisk",
};

const PRIORITETS_FARGE: Record<string, string> = {
  low: "text-gray-500",
  medium: "text-blue-600",
  high: "text-orange-600",
  critical: "text-red-600",
};

// Cast-type for å unngå TS2589 (excessively deep type instantiation)
interface OppgaveRad {
  id: string;
  title: string;
  status: string;
  priority: string;
  number?: number | null;
  description: string | null;
  dueDate: Date | string | null;
  updatedAt: Date | string;
  createdAt: Date | string;
  template?: { name: string; prefix?: string | null } | null;
  bestillerFaggruppe?: { name: string } | null;
  utforerFaggruppe?: { name: string } | null;
  creator?: { name: string | null } | null;
}

function formaterNummer(prefix: string | null | undefined, nummer: number | null | undefined): string | null {
  if (!prefix || nummer == null) return null;
  return `${prefix}${nummer}`;
}

export default function OppgaveListe() {
  const { valgtProsjektId } = useProsjekt();
  const router = useRouter();
  const queryClient = useQueryClient();

  const oppgaveQuery = trpc.oppgave.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId },
  );

  const oppgaver = oppgaveQuery.data as OppgaveRad[] | undefined;

  const onRefresh = useCallback(() => {
    queryClient.invalidateQueries();
  }, [queryClient]);

  const renderElement = useCallback(
    ({ item }: { item: OppgaveRad }) => {
      const nummer = formaterNummer(item.template?.prefix, item.number);
      const undertekst = [
        item.utforerFaggruppe?.name,
        item.dueDate
          ? new Date(item.dueDate).toLocaleDateString("nb-NO", {
              day: "numeric",
              month: "short",
            })
          : null,
      ]
        .filter(Boolean)
        .join(" · ");

      return (
        <Pressable
          onPress={() => {
            router.push(`/oppgave/${item.id}`);
          }}
          className="flex-row items-center border-b border-gray-100 bg-white px-4 py-3"
        >
          <View className="flex-1">
            <Text className="text-sm text-gray-900" numberOfLines={1}>
              {nummer ? <Text className="font-bold">{nummer} </Text> : null}{item.title}
            </Text>
            <View className="mt-0.5 flex-row items-center gap-2">
              <Text className={`text-xs font-medium ${PRIORITETS_FARGE[item.priority] ?? "text-gray-500"}`}>
                {PRIORITETS_TEKST[item.priority] ?? item.priority}
              </Text>
              {undertekst ? (
                <Text className="text-xs text-gray-500" numberOfLines={1}>
                  · {undertekst}
                </Text>
              ) : null}
            </View>
          </View>
          <StatusMerkelapp status={item.status} />
        </Pressable>
      );
    },
    [router],
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center bg-sitedoc-blue px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={22} color="#ffffff" />
        </Pressable>
        <Text className="ml-3 text-lg font-semibold text-white">
          Oppgaver
        </Text>
      </View>

      {oppgaveQuery.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#1e40af" />
          <Text className="mt-3 text-sm text-gray-500">Henter oppgaver...</Text>
        </View>
      ) : (
        <FlatList
          data={oppgaver ?? []}
          keyExtractor={(item) => item.id}
          renderItem={renderElement}
          refreshControl={
            <RefreshControl
              refreshing={oppgaveQuery.isRefetching}
              onRefresh={onRefresh}
            />
          }
          ListEmptyComponent={
            <View className="items-center px-4 pt-20">
              <Text className="text-base text-gray-500">Ingen oppgaver</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
