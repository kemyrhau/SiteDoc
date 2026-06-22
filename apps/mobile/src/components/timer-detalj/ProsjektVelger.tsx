import { useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  FlatList,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X, Check } from "lucide-react-native";
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
 */
export function ProsjektVelgerModal({
  organizationId,
  valgtId,
  ekskluderIder,
  onVelg,
  onLukk,
}: {
  organizationId: string;
  valgtId: string | null;
  ekskluderIder?: string[];
  onVelg: (id: string) => void;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const [sok, setSok] = useState("");

  const prosjekter = useMemo<Prosjekt[]>(() => {
    if (!organizationId) return [];
    const alle = hentProsjekterLokalt(organizationId);
    if (!ekskluderIder?.length) return alle;
    return alle.filter((p) => !ekskluderIder.includes(p.id));
  }, [organizationId, ekskluderIder]);

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
                {item.projectNumber && (
                  <Text className="text-xs text-gray-500">
                    {item.projectNumber}
                  </Text>
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
 * Viser valgt prosjekts navn + nummer. Åpner ProsjektVelgerModal ved trykk.
 */
export function ProsjektFelt({
  prosjektNavn,
  prosjektNummer,
  onTrykk,
}: {
  prosjektNavn: string | null;
  prosjektNummer: string | null;
  onTrykk: () => void;
}) {
  const { t } = useTranslation();
  // U2: tynn wrapper rundt VelgerFelt — formaterer prosjekt-strengen, deler
  // chevron-affordance med de øvrige velgerne.
  const verdi = prosjektNavn
    ? `${prosjektNummer ? prosjektNummer + " — " : ""}${prosjektNavn}`
    : null;
  return (
    <VelgerFelt
      verdi={verdi}
      placeholder={t("timer.velgProsjekt")}
      onPress={onTrykk}
    />
  );
}
