import { useState } from "react";
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Folder, FolderOpen, FileText, ChevronRight, ArrowLeft } from "lucide-react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { trpc } from "../../src/lib/trpc";
import { useProsjekt } from "../../src/kontekst/ProsjektKontekst";

interface MappeTre {
  id: string;
  name: string;
  parentId: string | null;
  _count: { ftdDocuments: number };
}

interface Dokument {
  id: string;
  filename: string;
  fileType: string;
  processingState: string;
  uploadedAt: string;
}

export default function BoksSkjerm() {
  const { t } = useTranslation();
  const { valgtProsjektId } = useProsjekt();
  // Stabel av åpne mapper for navigering bakover
  const [mappeSti, setMappeSti] = useState<{ id: string; navn: string }[]>([]);
  const åpenMappe = mappeSti.length > 0 ? mappeSti[mappeSti.length - 1]! : null;

  const { data: mapper, isLoading: mapperLaster } = trpc.mappe.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId },
  );

  const { data: dokumentData, isLoading: dokumenterLaster } = trpc.mappe.hentDokumenter.useQuery(
    { folderId: åpenMappe?.id ?? "" },
    { enabled: !!åpenMappe },
  );

  const alleMapper = (mapper ?? []) as MappeTre[];

  // Undermapper for gjeldende visning
  const barneMapper = alleMapper.filter(
    (m) => m.parentId === (åpenMappe?.id ?? null),
  );

  // Tell dokumenter rekursivt (direkte + undermapper)
  function tellDokumenterRekursivt(mappeId: string): number {
    const mappe = alleMapper.find((m) => m.id === mappeId);
    let total = mappe?._count.ftdDocuments ?? 0;
    for (const barn of alleMapper.filter((m) => m.parentId === mappeId)) {
      total += tellDokumenterRekursivt(barn.id);
    }
    return total;
  }

  const navigerTilMappe = (id: string, navn: string) => {
    setMappeSti((prev) => [...prev, { id, navn }]);
  };

  const navigerTilbake = () => {
    setMappeSti((prev) => prev.slice(0, -1));
  };

  if (!valgtProsjektId) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
        <View className="border-b border-gray-200 bg-white px-4 py-3">
          <Text className="text-lg font-semibold text-gray-900">{t("nav.mapper")}</Text>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <FolderOpen size={48} color="#9ca3af" />
          <Text className="mt-4 text-center text-sm text-gray-500">
            {t("hjem.velgProsjekt")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Dokumenter i åpen mappe
  const dokumenter = åpenMappe
    ? ((dokumentData as { dokumenter?: Dokument[] })?.dokumenter ?? []) as Dokument[]
    : [];

  // Bygg samlet liste: undermapper først, deretter dokumenter
  type ListeItem =
    | { type: "mappe"; id: string; navn: string; antall: number }
    | { type: "dokument"; id: string; filename: string; fileType: string; processingState: string };

  const listeData: ListeItem[] = [
    ...barneMapper.map((m) => ({
      type: "mappe" as const,
      id: m.id,
      navn: m.name,
      antall: tellDokumenterRekursivt(m.id),
    })),
    ...(åpenMappe
      ? dokumenter.map((d) => ({
          type: "dokument" as const,
          id: d.id,
          filename: d.filename,
          fileType: d.fileType,
          processingState: d.processingState,
        }))
      : []),
  ];

  const erLaster = mapperLaster || (åpenMappe && dokumenterLaster);

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center border-b border-gray-200 bg-white px-3 py-2.5">
        {åpenMappe ? (
          <TouchableOpacity onPress={navigerTilbake} className="mr-2 rounded-lg p-1.5">
            <ArrowLeft size={22} color="#374151" />
          </TouchableOpacity>
        ) : null}
        <Text className="flex-1 text-lg font-semibold text-gray-900" numberOfLines={1}>
          {åpenMappe?.navn ?? t("nav.mapper")}
        </Text>
      </View>

      {erLaster ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#1e40af" />
        </View>
      ) : listeData.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <FolderOpen size={40} color="#d1d5db" />
          <Text className="mt-3 text-sm text-gray-500">{t("feil.ikkeFunnet")}</Text>
        </View>
      ) : (
        <FlatList
          data={listeData}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          contentContainerStyle={{ paddingVertical: 4 }}
          renderItem={({ item }) => {
            if (item.type === "mappe") {
              return (
                <TouchableOpacity
                  onPress={() => navigerTilMappe(item.id, item.navn)}
                  className="flex-row items-center border-b border-gray-100 bg-white px-4 py-3"
                >
                  <Folder size={20} color="#1e40af" />
                  <Text className="ml-3 flex-1 text-sm font-medium text-gray-900">
                    {item.navn}
                  </Text>
                  {item.antall > 0 && (
                    <Text className="mr-2 text-xs text-gray-400">{item.antall}</Text>
                  )}
                  <ChevronRight size={16} color="#9ca3af" />
                </TouchableOpacity>
              );
            }

            return (
              <TouchableOpacity
                onPress={() => {
                  if (item.processingState === "completed") {
                    router.push(`/dokument/${item.id}`);
                  }
                }}
                className="flex-row items-center border-b border-gray-100 bg-white px-4 py-3"
                disabled={item.processingState !== "completed"}
              >
                <FileText
                  size={20}
                  color={item.processingState === "completed" ? "#1e40af" : "#9ca3af"}
                />
                <View className="ml-3 flex-1">
                  <Text
                    className={`text-sm font-medium ${
                      item.processingState === "completed" ? "text-gray-900" : "text-gray-400"
                    }`}
                    numberOfLines={1}
                  >
                    {item.filename}
                  </Text>
                  <Text className="mt-0.5 text-xs text-gray-400">
                    {(item.fileType ?? "").toUpperCase()}
                    {item.processingState === "processing" && ` — ${t("handling.prosesserer")}`}
                    {item.processingState === "pending" && ` — ${t("handling.laster")}`}
                    {item.processingState === "failed" && ` — ${t("feil.noeGikkGalt")}`}
                  </Text>
                </View>
                {item.processingState === "completed" && (
                  <ChevronRight size={16} color="#9ca3af" />
                )}
                {item.processingState === "processing" && (
                  <ActivityIndicator size="small" color="#1e40af" />
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
