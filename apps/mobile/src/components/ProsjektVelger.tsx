import {
  View,
  Text,
  Modal,
  Pressable,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X, Check } from "lucide-react-native";
import { trpc } from "../lib/trpc";
import { useProsjekt } from "../kontekst/ProsjektKontekst";

interface ProsjektVelgerProps {
  synlig: boolean;
  onLukk: () => void;
}

export function ProsjektVelger({ synlig, onLukk }: ProsjektVelgerProps) {
  const { valgtProsjektId, byttProsjekt } = useProsjekt();
  const { data: prosjekter, isLoading, error } = trpc.prosjekt.hentMine.useQuery();

  function velgProsjekt(id: string) {
    byttProsjekt(id);
    onLukk();
  }

  return (
    <Modal visible={synlig} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1 bg-white">
        {/* Header */}
        <View className="flex-row items-center justify-between border-b border-gray-200 px-4 py-3">
          <Text className="text-lg font-semibold text-gray-900">
            Velg prosjekt
          </Text>
          <Pressable onPress={onLukk} className="rounded-full p-2">
            <X size={24} color="#6b7280" />
          </Pressable>
        </View>

        {/* Innhold */}
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#1e40af" />
            <Text className="mt-3 text-sm text-gray-500">
              Henter prosjekter...
            </Text>
          </View>
        ) : error ? (
          <View className="flex-1 items-center justify-center px-4">
            <Text className="text-center text-sm text-red-500">
              Kunne ikke hente prosjekter. Sjekk nettverkstilkoblingen.
            </Text>
          </View>
        ) : !prosjekter || prosjekter.length === 0 ? (
          <View className="flex-1 items-center justify-center px-4">
            <Text className="text-center text-sm text-gray-500">
              Du kan logge inn på sitedoc.no og registrere nytt prosjekt
            </Text>
          </View>
        ) : (
          <FlatList
            data={prosjekter}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const erValgt = item.id === valgtProsjektId;
              return (
                <Pressable
                  onPress={() => velgProsjekt(item.id)}
                  className={`flex-row items-center justify-between border-b border-gray-100 px-4 py-4 ${
                    erValgt ? "bg-blue-50" : ""
                  }`}
                >
                  <View className="flex-1">
                    <Text
                      className={`text-base font-medium ${
                        erValgt ? "text-blue-700" : "text-gray-900"
                      }`}
                    >
                      {item.name}
                    </Text>
                    <Text className="mt-0.5 text-sm text-gray-500">
                      {item.projectNumber}
                    </Text>
                  </View>
                  {erValgt && <Check size={20} color="#1d4ed8" />}
                </Pressable>
              );
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}
