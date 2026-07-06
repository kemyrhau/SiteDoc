import { useMemo, useState } from "react";
import { View, Text, Pressable, SectionList, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  FileText,
  PenTool,
  Box,
  ChevronRight,
  Layers,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { trpc } from "../../src/lib/trpc";
import { useProsjekt } from "../../src/kontekst/ProsjektKontekst";

type Modus = "2d" | "3d" | "2d3d";

interface TegningRad {
  id: string;
  name: string;
  fileType: string | null;
  revision: string | null;
  byggeplass: { id: string; name: string } | null;
}

// Filtype-differensierte ikoner (fabel-krav ved thumbnail-degradering): listen
// skal skanne godt uten miniatyrbilder.
function ikonForFiltype(fileType: string | null): LucideIcon {
  const t = (fileType ?? "").toLowerCase();
  if (t === "pdf") return FileText;
  if (t === "dwg" || t === "dxf") return PenTool;
  if (t === "ifc") return Box;
  return FileText;
}

function filtypeEtikett(fileType: string | null): string {
  return (fileType ?? "").toUpperCase() || "—";
}

export default function TegningerTab() {
  const router = useRouter();
  const { t } = useTranslation();
  const { valgtProsjektId } = useProsjekt();
  const [modus, setModus] = useState<Modus>("2d");

  const { data: tegninger, isLoading } = trpc.tegning.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId },
  );

  const alle = (tegninger ?? []) as TegningRad[];

  // 3D-modul aktiv for prosjektet
  const { data: moduler } = trpc.modul.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId },
  );
  const er3dAktiv = useMemo(
    () =>
      (moduler ?? []).some(
        (m) => m.moduleSlug === "3d-visning" && m.status === "aktiv",
      ),
    [moduler],
  );

  const harIfc = useMemo(
    () => alle.some((tg) => (tg.fileType ?? "").toLowerCase() === "ifc"),
    [alle],
  );
  const kreverIfc = er3dAktiv && harIfc;

  // 2D-tegninger gruppert per byggeplass (IFC vises som eget kort, ikke i lista)
  const seksjoner = useMemo(() => {
    const to_d = alle.filter((tg) => (tg.fileType ?? "").toLowerCase() !== "ifc");
    const grupper = new Map<string, TegningRad[]>();
    for (const tg of to_d) {
      const navn = tg.byggeplass?.name ?? t("tegninger.utenByggeplass");
      const liste = grupper.get(navn) ?? [];
      liste.push(tg);
      grupper.set(navn, liste);
    }
    return Array.from(grupper.entries()).map(([tittel, data]) => ({
      tittel,
      data,
    }));
  }, [alle, t]);

  if (!valgtProsjektId) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
        <View className="border-b border-gray-200 bg-white px-4 py-3">
          <Text className="text-lg font-semibold text-gray-900">
            {t("nav.tegninger")}
          </Text>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <Layers size={48} color="#9ca3af" />
          <Text className="mt-4 text-center text-sm text-gray-500">
            {t("hjem.velgProsjekt")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      {/* Header */}
      <View className="border-b border-gray-200 bg-white px-4 py-3">
        <Text className="text-lg font-semibold text-gray-900">
          {t("nav.tegninger")}
        </Text>
      </View>

      {/* Segmentert kontroll [2D | 3D | 2D+3D] */}
      <View className="flex-row gap-2 border-b border-gray-200 bg-white px-4 py-3">
        <SegmentKnapp
          tekst={t("tegninger.2d")}
          aktiv={modus === "2d"}
          onPress={() => setModus("2d")}
        />
        <SegmentKnapp
          tekst={t("tegninger.3d")}
          aktiv={modus === "3d"}
          onPress={() => {
            setModus("3d");
            router.push("/3d-visning");
          }}
        />
        <SegmentKnapp
          tekst={t("tegninger.2d3d")}
          aktiv={modus === "2d3d"}
          onPress={() => {
            setModus("2d3d");
            router.push("/tegning-3d");
          }}
        />
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#1e40af" />
        </View>
      ) : (
        <SectionList
          sections={seksjoner}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          stickySectionHeadersEnabled={false}
          ListEmptyComponent={() => (
            <View className="items-center px-8 py-12">
              <Layers size={40} color="#d1d5db" />
              <Text className="mt-3 text-sm text-gray-500">
                {t("tegninger.ingenTegninger")}
              </Text>
            </View>
          )}
          renderSectionHeader={({ section }) => (
            <View className="bg-gray-50 px-4 pb-1.5 pt-4">
              <Text className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {section.tittel}
              </Text>
            </View>
          )}
          renderItem={({ item }) => {
            const Ikon = ikonForFiltype(item.fileType);
            return (
              <Pressable
                onPress={() => router.push("/lokasjoner")}
                className="flex-row items-center border-b border-gray-100 bg-white px-4 py-3 active:bg-gray-50"
              >
                <View className="h-10 w-10 items-center justify-center rounded-md bg-blue-50">
                  <Ikon size={20} color="#1e40af" />
                </View>
                <View className="ml-3 flex-1">
                  <Text
                    className="text-sm font-medium text-gray-900"
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  <Text className="mt-0.5 text-xs text-gray-400">
                    {filtypeEtikett(item.fileType)}
                    {item.revision
                      ? ` · ${t("tegninger.rev", { rev: item.revision })}`
                      : ""}
                  </Text>
                </View>
                <ChevronRight size={16} color="#9ca3af" />
              </Pressable>
            );
          }}
          ListFooterComponent={
            kreverIfc ? (
              <Pressable
                onPress={() => router.push("/3d-visning")}
                className="mx-4 mt-4 flex-row items-center rounded-xl border border-blue-100 bg-white px-4 py-3.5 active:bg-gray-50"
              >
                <View className="h-10 w-10 items-center justify-center rounded-md bg-sitedoc-blue">
                  <Box size={20} color="#ffffff" />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-sm font-semibold text-gray-900">
                    {t("tegninger.ifcKort")}
                  </Text>
                  <Text className="mt-0.5 text-xs text-gray-500">
                    {t("tegninger.ifcKortUnder")}
                  </Text>
                </View>
                <ChevronRight size={16} color="#9ca3af" />
              </Pressable>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

function SegmentKnapp({
  tekst,
  aktiv,
  onPress,
}: {
  tekst: string;
  aktiv: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 items-center rounded-lg py-2 ${
        aktiv ? "bg-sitedoc-blue" : "bg-gray-100"
      }`}
    >
      <Text
        className={`text-sm font-medium ${aktiv ? "text-white" : "text-gray-600"}`}
      >
        {tekst}
      </Text>
    </Pressable>
  );
}
