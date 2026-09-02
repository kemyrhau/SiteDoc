import {
  View,
  Text,
  Modal,
  Pressable,
  FlatList,
  ActivityIndicator,
} from "react-native";
// eslint-disable-next-line no-restricted-imports -- pageSheet — simulator-målt 2026-08-31: SafeAreaView anvender arkets egen topp-inset (~10 pt), header-kontroller truffbare. fullScreen-feilen gjelder ikke pageSheet.
import { SafeAreaView } from "react-native-safe-area-context";
import { X, Check, RefreshCw } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { trpc } from "../lib/trpc";
import { useProsjekt } from "../kontekst/ProsjektKontekst";
import { useFirma } from "../kontekst/FirmaKontekst";

interface ProsjektVelgerProps {
  synlig: boolean;
  onLukk: () => void;
}

export function ProsjektVelger({ synlig, onLukk }: ProsjektVelgerProps) {
  const { t } = useTranslation();
  const { valgtProsjektId, byttProsjekt } = useProsjekt();
  const { valgtFirmaId, firmaer, lasterFirmaer } = useFirma();
  const prosjektQuery = trpc.prosjekt.hentMine.useQuery(
    { organizationId: valgtFirmaId ?? undefined },
    { enabled: !!valgtFirmaId || (!lasterFirmaer && firmaer.length === 0) },
  );
  const { data: prosjekter, isLoading, error } = prosjektQuery;

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
            {t("prosjektVelger.velgProsjekt")}
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
              {t("prosjektVelger.henter")}
            </Text>
          </View>
        ) : error ? (
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-center text-base font-medium text-gray-900">
              {t("prosjektVelger.kunneIkkeHente")}
            </Text>
            <Text className="mt-2 text-center text-sm text-gray-500">
              {error.message ?? t("prosjektVelger.sjekkNettverk")}
            </Text>
            <Pressable
              onPress={() => prosjektQuery.refetch()}
              className="mt-4 flex-row items-center gap-2 rounded-lg bg-blue-600 px-6 py-3"
            >
              <RefreshCw size={16} color="#ffffff" />
              <Text className="font-medium text-white">{t("handling.provIgjen")}</Text>
            </Pressable>
          </View>
        ) : !prosjekter || prosjekter.length === 0 ? (
          <View className="flex-1 items-center justify-center px-4">
            <Text className="text-center text-sm text-gray-500">
              {t("prosjektVelger.ingenBeskrivelse")}
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
