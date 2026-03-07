import { useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  Modal,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native";
import { X } from "lucide-react-native";
import { trpc } from "../lib/trpc";
import { useProsjekt } from "../kontekst/ProsjektKontekst";

interface MalData {
  id: string;
  name: string;
  prefix: string | null;
  category: string;
  subjects?: string[];
}

interface MalVelgerProps {
  synlig: boolean;
  kategori: "sjekkliste" | "oppgave";
  onVelg: (mal: MalData) => void;
  onLukk: () => void;
}

export function MalVelger({ synlig, kategori, onVelg, onLukk }: MalVelgerProps) {
  const { valgtProsjektId } = useProsjekt();

  const malQuery = trpc.mal.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId && synlig },
  );

  const maler = malQuery.data as MalData[] | undefined;

  const filtrerteMaler = useMemo(
    () => maler?.filter((m) => m.category === kategori) ?? [],
    [maler, kategori],
  );

  return (
    <Modal visible={synlig} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: "#ffffff" }}>
        {/* Header */}
        <View className="flex-row items-center justify-between bg-sitedoc-blue px-4 py-3">
          <Text className="text-sm font-semibold text-white">
            Velg {kategori === "sjekkliste" ? "sjekklistemal" : "oppgavemal"}
          </Text>
          <Pressable onPress={onLukk} hitSlop={12}>
            <X size={20} color="#ffffff" />
          </Pressable>
        </View>

        {malQuery.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#1e40af" />
            <Text className="mt-3 text-sm text-gray-500">Henter maler...</Text>
          </View>
        ) : filtrerteMaler.length === 0 ? (
          <View className="flex-1 items-center justify-center px-4">
            <Text className="text-base text-gray-500">
              Ingen {kategori === "sjekkliste" ? "sjekkliste" : "oppgave"}maler funnet
            </Text>
          </View>
        ) : (
          <FlatList
            data={filtrerteMaler}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => onVelg(item)}
                className="flex-row items-center border-b border-gray-100 bg-white px-4 py-3.5"
              >
                <View className="flex-1">
                  <Text className="text-sm font-medium text-gray-900">
                    {item.name}
                  </Text>
                </View>
                {item.prefix ? (
                  <View className="rounded bg-gray-100 px-2 py-1">
                    <Text className="text-xs font-medium text-gray-600">
                      {item.prefix}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}
