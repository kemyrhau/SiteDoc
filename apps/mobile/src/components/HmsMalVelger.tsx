import { useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { trpc } from "../lib/trpc";
import { useProsjekt } from "../kontekst/ProsjektKontekst";

export type HmsSubdomain = "avvik" | "sja" | "ruh";

export interface HmsMal {
  id: string;
  name: string;
  prefix: string | null;
  subdomain: HmsSubdomain;
}

interface MalRef {
  id: string;
  name: string;
  prefix: string | null;
  subdomain: string | null;
  category?: string;
}

/**
 * HMS-mal-velger for mobil. Generisk `MalVelger` filtrerer på category
 * "sjekkliste"|"oppgave" og viser derfor ikke HMS-maler (category="hms").
 * Denne henter HMS-maler og grupperer dem på subdomain (avvik/SJA/RUH),
 * med hjelpetekst per type. Speiler web-ens «Meld HMS»-dropdown.
 */
export function HmsMalVelger({
  synlig,
  onVelg,
  onLukk,
}: {
  synlig: boolean;
  onVelg: (mal: HmsMal) => void;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const { valgtProsjektId } = useProsjekt();

  const malerQuery = trpc.mal.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId && synlig },
  );

  const hmsMaler = useMemo(() => {
    const maler = (malerQuery.data ?? []) as MalRef[];
    return maler
      .filter(
        (m) =>
          m.category === "hms" &&
          (m.subdomain === "avvik" || m.subdomain === "sja" || m.subdomain === "ruh"),
      )
      .map((m) => ({ ...m, subdomain: m.subdomain as HmsSubdomain }));
  }, [malerQuery.data]);

  return (
    <Modal visible={synlig} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1 bg-white" edges={["top", "bottom"]}>
        <View className="flex-row items-center justify-between border-b border-gray-200 px-4 py-3">
          <Text className="text-base font-semibold text-gray-900">
            {t("hms.handling.meld")}
          </Text>
          <Pressable onPress={onLukk} hitSlop={12}>
            <X size={22} color="#374151" />
          </Pressable>
        </View>

        {malerQuery.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#1e40af" />
          </View>
        ) : hmsMaler.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-center text-base text-gray-500">
              {t("hms.ingenMalerTilgjengelig")}
            </Text>
          </View>
        ) : (
          <ScrollView>
            {hmsMaler.map((mal) => (
              <Pressable
                key={mal.id}
                onPress={() => onVelg(mal)}
                className="border-b border-gray-100 px-4 py-3"
              >
                <Text className="text-sm font-semibold text-gray-900">
                  {mal.prefix ? <Text className="text-gray-500">{mal.prefix} </Text> : null}
                  {mal.name}
                </Text>
                <Text className="mt-0.5 text-xs text-gray-500" numberOfLines={2}>
                  {t(`hms.hjelp.${mal.subdomain}`)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}
