import { View, Text, Modal, Pressable, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X, Check } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useFirma } from "../kontekst/FirmaKontekst";

interface FirmaVelgerProps {
  synlig: boolean;
  onLukk: () => void;
}

export function FirmaVelger({ synlig, onLukk }: FirmaVelgerProps) {
  const { t } = useTranslation();
  const { firmaer, valgtFirmaId, byttFirma, lasterFirmaer } = useFirma();

  function velgFirma(id: string) {
    byttFirma(id);
    onLukk();
  }

  return (
    <Modal visible={synlig} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-row items-center justify-between border-b border-gray-200 px-4 py-3">
          <Text className="text-lg font-semibold text-gray-900">
            {t("firma.velgFirma")}
          </Text>
          <Pressable onPress={onLukk} className="rounded-full p-2">
            <X size={24} color="#6b7280" />
          </Pressable>
        </View>

        {lasterFirmaer ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-sm text-gray-500">
              {t("firma.henterFirmaer")}
            </Text>
          </View>
        ) : firmaer.length === 0 ? (
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-center text-sm text-gray-500">
              {t("firma.ingenFirmaer")}
            </Text>
          </View>
        ) : (
          <FlatList
            data={firmaer}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const erValgt = item.id === valgtFirmaId;
              return (
                <Pressable
                  onPress={() => velgFirma(item.id)}
                  className={`flex-row items-center justify-between border-b border-gray-100 px-4 py-4 ${
                    erValgt ? "bg-blue-50" : ""
                  }`}
                >
                  <Text
                    className={`flex-1 text-base font-medium ${
                      erValgt ? "text-blue-700" : "text-gray-900"
                    }`}
                  >
                    {item.name}
                  </Text>
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
