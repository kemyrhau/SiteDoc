import { useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  FlatList,
  TextInput,
} from "react-native";
// eslint-disable-next-line no-restricted-imports -- pageSheet — simulator-målt 2026-08-31: SafeAreaView anvender arkets egen topp-inset (~10 pt), header-kontroller truffbare. fullScreen-feilen gjelder ikke pageSheet.
import { SafeAreaView } from "react-native-safe-area-context";
import { X, Check, MapPin } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { hentProsjekterLokalt } from "../../services/prosjektKatalog";
import type { Prosjekt } from "../../types/timer-detalj";
import { VelgerFelt } from "./VelgerFelt";

/**
 * Prosjekt-velger-modal for rad-nivå prosjektvalg (T7-3b2 2026-05-14).
 * Leser fra prosjektLocal — offline-trygt etter første sync.
 *
 * Eksluderer-prop kan brukes for «+ Legg til rad i annet prosjekt» der vi
 * bare vil vise prosjekter som ikke allerede har rader på sedelen.
 *
 * `forslagId` (ORDRE 17, «+» rett til raden): GPS-/byggeplass-treffet løftes
 * øverst med merket «Foreslått basert på posisjon». Forhåndsvalget selv er
 * kallerens `valgtId` — lista hoppes ikke over (Kenneth Q1).
 */
export function ProsjektVelgerModal({
  organizationId,
  valgtId,
  ekskluderIder,
  forslagId = null,
  onVelg,
  onLukk,
}: {
  organizationId: string;
  valgtId: string | null;
  ekskluderIder?: string[];
  forslagId?: string | null;
  onVelg: (id: string) => void;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const [sok, setSok] = useState("");

  const prosjekter = useMemo<Prosjekt[]>(() => {
    if (!organizationId) return [];
    const alle = hentProsjekterLokalt(organizationId).filter(
      (p) => !ekskluderIder?.includes(p.id),
    );
    const forslag = alle.find((p) => p.id === forslagId);
    return forslag ? [forslag, ...alle.filter((p) => p !== forslag)] : alle;
  }, [organizationId, ekskluderIder, forslagId]);

  const filtrert = useMemo(() => {
    if (!sok.trim()) return prosjekter;
    const q = sok.toLowerCase();
    return prosjekter.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.projectNumber ?? "").toLowerCase().includes(q),
    );
  }, [prosjekter, sok]);

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
            {t("timer.velgProsjekt")}
          </Text>
          <Pressable onPress={onLukk} hitSlop={12}>
            <X size={24} color="#1f2937" />
          </Pressable>
        </View>
        {prosjekter.length > 7 && (
          <View className="border-b border-gray-200 px-4 py-2">
            <TextInput
              value={sok}
              onChangeText={setSok}
              placeholder={t("handling.sok")}
              className="rounded bg-gray-100 px-3 py-2 text-base"
            />
          </View>
        )}
        <FlatList
          data={filtrert}
          keyExtractor={(item) => item.id}
          automaticallyAdjustKeyboardInsets
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onVelg(item.id)}
              className={`flex-row items-center border-b border-gray-100 px-4 py-3 ${
                item.id === valgtId ? "bg-blue-50" : ""
              }`}
            >
              <View className="flex-1">
                <Text className="text-base text-gray-900">{item.name}</Text>
                {item.id === forslagId && (
                  <View className="mt-0.5 flex-row items-center gap-1">
                    <MapPin size={12} color="#1e40af" />
                    <Text className="text-xs text-sitedoc-primary">
                      {t("timer.geoForslag")}
                    </Text>
                  </View>
                )}
              </View>
              {item.id === valgtId && <Check size={18} color="#1e40af" />}
            </Pressable>
          )}
          ListEmptyComponent={() => (
            <View className="px-4 py-8">
              <Text className="text-center text-gray-500">
                {t("timer.ingenTilgjengelige")}
              </Text>
            </View>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}

/**
 * Trykkbar prosjekt-felt-knapp til bruk i edit-modaler.
 * Viser valgt prosjekts navn (aldri nummeret — Kenneth 2026-11-12). Åpner ProsjektVelgerModal ved trykk.
 */
export function ProsjektFelt({
  prosjektNavn,
  onTrykk,
  laast = false,
}: {
  prosjektNavn: string | null;
  onTrykk: () => void;
  /** Prosjektkortet: prosjektet hører til kortet og kan ikke byttes (16c). */
  laast?: boolean;
}) {
  const { t } = useTranslation();
  // U2: tynn wrapper rundt VelgerFelt — deler chevron-affordance med de
  // øvrige velgerne. null = ingen valgt → placeholder.
  const verdi = prosjektNavn;
  return (
    <VelgerFelt
      verdi={verdi}
      placeholder={t("timer.velgProsjekt")}
      onPress={onTrykk}
      laast={laast}
    />
  );
}
