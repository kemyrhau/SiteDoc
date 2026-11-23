import { useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  ActivityIndicator,
} from "react-native";
// eslint-disable-next-line no-restricted-imports -- pageSheet — simulator-målt 2026-08-31: SafeAreaView anvender arkets egen topp-inset (~10 pt), header-kontroller truffbare. fullScreen-feilen gjelder ikke pageSheet.
import { SafeAreaView } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { erMeldbarHmsMal } from "@sitedoc/shared";
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
  domain?: string | null;
}

/**
 * HMS-mal-velger for mobil. Viser alle domain hms-maler (avvik/SJA/RUH) uansett
 * category — `erMeldbarHmsMal`, samme regel som web-ens «Meld HMS» (HM1 tillegg A).
 * Grupperes på subdomain (avvik/SJA/RUH),
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
      // HM1 tillegg A: domain hms (også seedede category oppgave/sjekkliste), delt med web.
      .filter(erMeldbarHmsMal)
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
                  {mal.prefix && mal.prefix !== mal.name ? (
                    <Text className="text-gray-500">{mal.prefix} </Text>
                  ) : null}
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
