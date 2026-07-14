import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  FlatList,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X, Check, Star } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import {
  hentByggeplasserForProsjektLokalt,
  refreshByggeplassKatalog,
} from "../../services/byggeplassKatalog";
import { finnProsjektLokalt } from "../../services/prosjektKatalog";
import { useByggeplass } from "../../kontekst/ByggeplassKontekst";
import { useNettverk } from "../../providers/NettverkProvider";
import { trpc } from "../../lib/trpc";

/**
 * Byggeplass-velger-modal for sedel-nivå byggeplass (L1, B6 sedel-nivå-runde).
 * Leser byggeplassLocal filtrert på sedelens prosjekt — offline-trygt etter
 * R4-sync. Sedel-nivå (én byggeplass per dag, jf. @@unique(userId, dato));
 * per-rad/«splitt dagen» er Beslutning 6-oppfølger.
 */
export function ByggeplassVelgerModal({
  projectId,
  valgtId,
  gpsForeslagId,
  onVelg,
  onLukk,
}: {
  projectId: string;
  valgtId: string | null;
  /** F3: GPS-foreslått byggeplass — badges «du er her» på raden. */
  gpsForeslagId?: string | null;
  onVelg: (id: string) => void;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const { favorittIder, toggleFavoritt } = useByggeplass();
  const { erPaaNettet } = useNettverk();
  const utils = trpc.useUtils();
  const [sok, setSok] = useState("");
  // F2 tri-tilstand: skill «henter» / «offline» / «bekreftet tomt» fra hverandre.
  const [laster, setLaster] = useState(false);
  const [refreshFullført, setRefreshFullført] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const byggeplasser = useMemo(() => {
    if (!projectId) return [];
    return hentByggeplasserForProsjektLokalt(projectId);
    // refreshNonce tvinger re-lesing etter at et byggeplass-refresh fullførte.
  }, [projectId, refreshNonce]);

  // F3-forberedelse (fabels catch): når modalen tillater prosjektbytte inline
  // endres `projectId` uten remount → nullstill refresh-tilstand + søk, ellers
  // ville et nytt prosjekt vist «bekreftet tomt» basert på FORRIGE prosjekts
  // fullførte refresh. Kjører også ved mount (verdiene er allerede default).
  useEffect(() => {
    setLaster(false);
    setRefreshFullført(false);
    setSok("");
  }, [projectId]);

  // F2: tom cache + online → hent byggeplasser ved åpning. Rotårsak: sync er
  // online-gated + async (TimerSyncProvider), så cachen kan være tom i et
  // LEGITIMT vindu (offline / før første sync). «Bekreftet tomt» (tilstand 3)
  // vises kun ETTER at et refresh har fullført tomt — aldri før.
  useEffect(() => {
    if (
      !projectId ||
      byggeplasser.length > 0 ||
      !erPaaNettet ||
      laster ||
      refreshFullført
    ) {
      return;
    }
    const orgId = finnProsjektLokalt(projectId)?.organizationId;
    if (!orgId) return;
    let avbrutt = false;
    setLaster(true);
    refreshByggeplassKatalog(utils.client, orgId)
      .catch(() => {
        // Feil svelges (samme som TimerSyncProvider) — velgeren faller tilbake
        // til «bekreftet tomt»/eksisterende cache; ikke kritisk sti.
      })
      .finally(() => {
        if (avbrutt) return;
        setLaster(false);
        setRefreshFullført(true);
        setRefreshNonce((n) => n + 1);
      });
    return () => {
      avbrutt = true;
    };
  }, [
    projectId,
    byggeplasser.length,
    erPaaNettet,
    laster,
    refreshFullført,
    utils.client,
  ]);

  const filtrert = useMemo(() => {
    const q = sok.trim().toLowerCase();
    const treff = q
      ? byggeplasser.filter(
          (b) =>
            (b.navn ?? "").toLowerCase().includes(q) ||
            String(b.number ?? "").includes(q),
        )
      : byggeplasser;
    // F6: sortér favoritter → GPS-forslag → resten (stabil innen hver gruppe).
    const rang = (id: string) =>
      favorittIder.includes(id) ? 0 : id === gpsForeslagId ? 1 : 2;
    return [...treff].sort((a, b) => rang(a.id) - rang(b.id));
  }, [byggeplasser, sok, favorittIder, gpsForeslagId]);

  return (
    <Modal
      visible={true}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onLukk}
    >
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <View className="flex-row items-center gap-2 border-b border-gray-200 px-4 py-3">
          <Text className="flex-1 text-lg font-semibold text-gray-900">
            {t("byggeplassVelger.velg")}
          </Text>
          <Pressable onPress={onLukk} hitSlop={12}>
            <X size={24} color="#1f2937" />
          </Pressable>
        </View>
        {byggeplasser.length > 7 && (
          <View className="border-b border-gray-200 px-4 py-2">
            <TextInput
              value={sok}
              onChangeText={setSok}
              placeholder={t("byggeplassVelger.sok")}
              className="rounded bg-gray-100 px-3 py-2 text-base"
            />
          </View>
        )}
        <FlatList
          data={filtrert}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onVelg(item.id)}
              className={`flex-row items-center border-b border-gray-100 px-4 py-3 ${
                item.id === valgtId ? "bg-blue-50" : ""
              }`}
            >
              <View className="flex-1">
                <Text className="text-base text-gray-900">
                  {item.navn ?? item.id}
                </Text>
                {item.id === gpsForeslagId ? (
                  <Text className="text-xs text-green-600">
                    {t("byggeplassVelger.gpsForeslarHer")}
                  </Text>
                ) : favorittIder.includes(item.id) ? (
                  <Text className="text-xs text-amber-600">
                    {t("byggeplassVelger.favoritt")}
                  </Text>
                ) : (
                  item.number != null && (
                    <Text className="text-xs text-gray-500">#{item.number}</Text>
                  )
                )}
              </View>
              {/* F6: stjerne-toggle (egen trykk-flate — velger ikke byggeplass) */}
              <Pressable
                onPress={() => toggleFavoritt(item.id)}
                hitSlop={10}
                className="px-1"
              >
                <Star
                  size={18}
                  color="#d97706"
                  fill={favorittIder.includes(item.id) ? "#d97706" : "none"}
                />
              </Pressable>
              {item.id === valgtId && <Check size={18} color="#1e40af" />}
            </Pressable>
          )}
          ListEmptyComponent={() => {
            // Søk uten treff (cachen HAR data) → egen tilstand, ikke tri-tilstand.
            if (sok.trim() && byggeplasser.length > 0) {
              return (
                <View className="px-4 py-8">
                  <Text className="text-center text-gray-500">
                    {t("byggeplassVelger.ingenTreff")}
                  </Text>
                </View>
              );
            }
            // Tom cache — tri-tilstand (F2).
            if (laster) {
              return (
                <View className="items-center px-4 py-8">
                  <ActivityIndicator color="#1e40af" />
                  <Text className="mt-3 text-center text-gray-500">
                    {t("byggeplassVelger.lastes")}
                  </Text>
                </View>
              );
            }
            if (!erPaaNettet && !refreshFullført) {
              return (
                <View className="px-4 py-8">
                  <Text className="text-center text-gray-500">
                    {t("byggeplassVelger.offline")}
                  </Text>
                </View>
              );
            }
            if (refreshFullført) {
              return (
                <View className="px-4 py-8">
                  <Text className="text-center text-gray-500">
                    {t("byggeplassVelger.prosjektMangler")}
                  </Text>
                </View>
              );
            }
            // Initial (før effekten rakk å kjøre) — nøytral melding.
            return (
              <View className="px-4 py-8">
                <Text className="text-center text-gray-500">
                  {t("byggeplassVelger.ingen")}
                </Text>
              </View>
            );
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}
