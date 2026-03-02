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
import { trpc } from "../../src/lib/trpc";
import { useProsjekt } from "../../src/kontekst/ProsjektKontekst";
import { StatusMerkelapp } from "../../src/components/StatusMerkelapp";

// Cast-type for å unngå TS2589 (excessively deep type instantiation)
interface SjekklisteRad {
  id: string;
  title: string;
  status: string;
  number?: number | null;
  updatedAt: Date | string;
  createdAt: Date | string;
  template?: { name: string; prefix?: string | null } | null;
  creatorEnterprise?: { name: string } | null;
  responderEnterprise?: { name: string } | null;
  creator?: { name: string | null } | null;
}

function formaterNummer(prefix: string | null | undefined, nummer: number | null | undefined): string | null {
  if (!prefix || nummer == null) return null;
  return `${prefix}${nummer}`;
}

export default function SjekklisteListe() {
  const { valgtProsjektId } = useProsjekt();
  const router = useRouter();

  const sjekklisteQuery = trpc.sjekkliste.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId },
  );

  const sjekklister = sjekklisteQuery.data as SjekklisteRad[] | undefined;

  const onRefresh = useCallback(() => {
    sjekklisteQuery.refetch();
  }, [sjekklisteQuery]);

  const renderElement = useCallback(
    ({ item }: { item: SjekklisteRad }) => {
      const nummer = formaterNummer(item.template?.prefix, item.number);
      const undertekst = [
        item.template?.name,
        item.responderEnterprise?.name,
      ]
        .filter(Boolean)
        .join(" · ");

      return (
        <Pressable
          onPress={() => router.push(`/sjekkliste/${item.id}`)}
          className="flex-row items-center border-b border-gray-100 bg-white px-4 py-3"
        >
          <View className="flex-1">
            <Text className="text-sm text-gray-900" numberOfLines={1}>
              {nummer ? <Text className="font-bold">{nummer} </Text> : null}{item.title}
            </Text>
            {undertekst ? (
              <Text className="mt-0.5 text-xs text-gray-500" numberOfLines={1}>
                {undertekst}
              </Text>
            ) : null}
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
      <View className="flex-row items-center bg-siteflow-blue px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={22} color="#ffffff" />
        </Pressable>
        <Text className="ml-3 text-lg font-semibold text-white">
          Sjekklister
        </Text>
      </View>

      {sjekklisteQuery.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#1e40af" />
          <Text className="mt-3 text-sm text-gray-500">Henter sjekklister...</Text>
        </View>
      ) : (
        <FlatList
          data={sjekklister ?? []}
          keyExtractor={(item) => item.id}
          renderItem={renderElement}
          refreshControl={
            <RefreshControl
              refreshing={sjekklisteQuery.isRefetching}
              onRefresh={onRefresh}
            />
          }
          ListEmptyComponent={
            <View className="items-center px-4 pt-20">
              <Text className="text-base text-gray-500">Ingen sjekklister</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
