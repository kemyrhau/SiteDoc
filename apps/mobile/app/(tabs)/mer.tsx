import { useState, useCallback } from "react";
import { View, Text, Pressable, ScrollView, Alert, Modal, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { LucideIcon } from "lucide-react-native";
import {
  Settings,
  Printer,
  Download,
  Users,
  Building2,
  WifiOff,
  QrCode,
  ChevronRight,
  LogOut,
  Globe,
  Check,
} from "lucide-react-native";
import { ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../src/providers/AuthProvider";
import { useProsjekt } from "../../src/kontekst/ProsjektKontekst";
import { useByggeplass } from "../../src/kontekst/ByggeplassKontekst";
import { trpc } from "../../src/lib/trpc";
import { klargjørForOffline } from "../../src/services/offlineKlargjoring";
import { byttSpraak } from "../../src/lib/i18n";
import { STOETTEDE_SPRAAK } from "@sitedoc/shared";
import type { SpraakKode } from "@sitedoc/shared";

export default function MerSkjerm() {
  const { t, i18n } = useTranslation();
  const { bruker, loggUt } = useAuth();
  const { valgtProsjektId } = useProsjekt();
  const { valgtBygningId } = useByggeplass();
  const [offlineTekst, setOfflineTekst] = useState<string | null>(null);
  const [visSpraakModal, setVisSpraakModal] = useState(false);

  const { data: medlemmer } = trpc.medlem.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId },
  );

  const tegningerQuery = trpc.tegning.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId!, ...(valgtBygningId ? { byggeplassId: valgtBygningId } : {}) },
    { enabled: !!valgtProsjektId },
  );

  const oppdaterSpraakMut = trpc.bruker.oppdaterSpraak.useMutation();

  const startOffline = useCallback(async () => {
    if (!tegningerQuery.data) {
      Alert.alert("Feil", "Tegninger er ikke lastet ennå. Prøv igjen.");
      return;
    }
    setOfflineTekst("Starter...");
    try {
      const resultat = await klargjørForOffline(
        tegningerQuery.data as Array<{ id: string; name: string; fileUrl: string | null; fileType: string | null; updatedAt?: string }>,
        (s) => setOfflineTekst(`${s.steg} ${s.ferdigeProsent}%`),
      );
      setOfflineTekst(`Ferdig: ${resultat.tegningerLastet} tegninger, ${resultat.ifcLastet} 3D-modeller`);
      setTimeout(() => setOfflineTekst(null), 4000);
    } catch (err) {
      setOfflineTekst(`Feil: ${err instanceof Error ? err.message : String(err)}`);
      setTimeout(() => setOfflineTekst(null), 5000);
    }
  }, [tegningerQuery.data]);

  const velgSpraak = useCallback(async (kode: SpraakKode) => {
    setVisSpraakModal(false);
    await byttSpraak(kode);
    oppdaterSpraakMut.mutate({ language: kode });
  }, [oppdaterSpraakMut]);

  const erAdmin = medlemmer?.some(
    (m) => m.user.email === bruker?.email && m.role === "admin",
  );

  const initialer = bruker?.name
    ? bruker.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "??";

  const aktivtSpraak = STOETTEDE_SPRAAK.find((s) => s.kode === i18n.language);

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      <View className="border-b border-gray-200 bg-white px-4 py-3">
        <Text className="text-lg font-semibold text-gray-900">{t("nav.mer")}</Text>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="pb-8">
        {/* Prosjekthandlinger */}
        <View className="mt-4">
          <View className="border-b border-gray-200 px-4 pb-1.5 pt-3">
            <Text className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {t("mer.prosjekt")}
            </Text>
          </View>
          <MenyRad
            ikon={Settings}
            tekst={t("mer.prosjektinnstillinger")}
            deaktivert={!erAdmin}
            onPress={() => {
              if (!erAdmin) {
                Alert.alert(t("feil.ingenTilgang"), t("feil.kunAdmin"));
              } else {
                Alert.alert(t("mer.prosjektinnstillinger"), "Åpne prosjektinnstillinger på sitedoc.no for full redigering.");
              }
            }}
          />
          <MenyRad
            ikon={Printer}
            tekst={t("handling.skrivUt")}
            onPress={() => {
              Alert.alert(t("handling.skrivUt"), "Utskriftsfunksjonalitet kommer snart.");
            }}
          />
          <MenyRad
            ikon={Download}
            tekst={t("handling.eksporter")}
            onPress={() => {
              Alert.alert(t("handling.eksporter"), "Eksportfunksjonalitet kommer snart.");
            }}
          />
        </View>

        {/* Generelt */}
        <View className="mt-4">
          <View className="border-b border-gray-200 px-4 pb-1.5 pt-3">
            <Text className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {t("mer.generelt")}
            </Text>
          </View>
          <MenyRad ikon={Users} tekst={t("nav.kontakter")} />
          <MenyRad ikon={Building2} tekst={t("nav.grupper")} />
          <MenyRad ikon={WifiOff} tekst={offlineTekst ?? t("mer.forberedOffline")} onPress={startOffline} />
          <MenyRad ikon={QrCode} tekst={t("mer.skannQR")} />
        </View>

        {/* Språk */}
        <View className="mt-4">
          <View className="border-b border-gray-200 px-4 pb-1.5 pt-3">
            <Text className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {t("toppbar.spraak")}
            </Text>
          </View>
          <Pressable
            onPress={() => setVisSpraakModal(true)}
            className="flex-row items-center justify-between border-b border-gray-100 bg-white px-4 py-3.5 active:bg-gray-50"
          >
            <View className="flex-row items-center gap-3">
              <Globe size={20} color="#6b7280" />
              <Text className="text-base text-gray-900">{t("toppbar.spraak")}</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Text className="text-sm text-gray-500">
                {aktivtSpraak?.flagg} {aktivtSpraak?.navn ?? i18n.language}
              </Text>
              <ChevronRight size={18} color="#d1d5db" />
            </View>
          </Pressable>
        </View>

        {/* Brukerprofil */}
        <View className="mx-4 mt-6 rounded-xl bg-white p-4">
          <View className="flex-row items-center gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-sitedoc-blue">
              <Text className="text-base font-bold text-white">
                {initialer}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-gray-900">
                {bruker?.name ?? "Ukjent bruker"}
              </Text>
              <Text className="text-sm text-gray-500">
                {bruker?.email ?? ""}
              </Text>
            </View>
          </View>
        </View>

        {/* Logg ut */}
        <View className="mx-4 mt-6">
          <Pressable
            onPress={loggUt}
            className="items-center rounded-lg bg-red-50 py-3 active:bg-red-100"
          >
            <View className="flex-row items-center gap-2">
              <LogOut size={18} color="#ef4444" />
              <Text className="text-base font-medium text-red-600">
                {t("toppbar.loggUt")}
              </Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>

      {/* Språkvelger-modal */}
      <Modal visible={visSpraakModal} transparent animationType="fade">
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setVisSpraakModal(false)}
          className="flex-1 bg-black/30 justify-end"
        >
          <View className="rounded-t-2xl bg-white pb-8 pt-4">
            <Text className="mb-3 px-5 text-sm font-semibold text-gray-900">Velg språk</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {STOETTEDE_SPRAAK.map((spraak) => {
                const erValgt = spraak.kode === i18n.language;
                return (
                  <TouchableOpacity
                    key={spraak.kode}
                    onPress={() => velgSpraak(spraak.kode)}
                    className={`flex-row items-center gap-3 px-5 py-3 ${erValgt ? "bg-blue-50" : ""}`}
                  >
                    <Text className="text-base">{spraak.flagg}</Text>
                    <Text className={`flex-1 text-sm ${erValgt ? "font-semibold text-sitedoc-primary" : "text-gray-700"}`}>
                      {spraak.navn}
                    </Text>
                    {erValgt && <Check size={18} color="#1e40af" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

function MenyRad({
  ikon: Ikon,
  tekst,
  deaktivert,
  onPress,
}: {
  ikon: LucideIcon;
  tekst: string;
  deaktivert?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-between border-b border-gray-100 bg-white px-4 py-3.5 active:bg-gray-50"
      style={deaktivert ? { opacity: 0.4 } : undefined}
    >
      <View className="flex-row items-center gap-3">
        <Ikon size={20} color="#6b7280" />
        <Text className="text-base text-gray-900">{tekst}</Text>
      </View>
      <ChevronRight size={18} color="#d1d5db" />
    </Pressable>
  );
}
