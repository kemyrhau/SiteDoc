import { useState } from "react";
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Folder, FolderOpen, FileText, ChevronRight, ArrowLeft } from "lucide-react-native";
import { router } from "expo-router";
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
  const { valgtProsjektId } = useProsjekt();
  const [åpenMappe, setÅpenMappe] = useState<{ id: string; navn: string } | null>(null);

  const { data: mapper, isLoading: mapperLaster } = trpc.mappe.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId },
  );

  const { data: dokumentData, isLoading: dokumenterLaster } = trpc.mappe.hentDokumenter.useQuery(
    { folderId: åpenMappe?.id ?? "" },
    { enabled: !!åpenMappe },
  );

  // Vis mapper på toppnivå (eller undermapper)
  const synligeMapper = (mapper ?? []).filter(
    (m: MappeTre) => m.parentId === null,
  ) as MappeTre[];

  if (!valgtProsjektId) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
        <View className="border-b border-gray-200 bg-white px-4 py-3">
          <Text className="text-lg font-semibold text-gray-900">Mapper</Text>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <FolderOpen size={48} color="#9ca3af" />
          <Text className="mt-4 text-center text-sm text-gray-500">
            Velg et prosjekt for å se dokumenter
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Dokumentliste for åpen mappe
  if (åpenMappe) {
    const dokumenter = ((dokumentData as { dokumenter?: Dokument[] })?.dokumenter ?? []) as Dokument[];
    return (
      <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
        <View className="flex-row items-center border-b border-gray-200 bg-white px-3 py-2.5">
          <TouchableOpacity onPress={() => setÅpenMappe(null)} className="mr-2 rounded-lg p-1.5">
            <ArrowLeft size={22} color="#374151" />
          </TouchableOpacity>
          <Text className="flex-1 text-sm font-semibold text-gray-900" numberOfLines={1}>
            {åpenMappe.navn}
          </Text>
        </View>
        {dokumenterLaster ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#1e40af" />
          </View>
        ) : dokumenter.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <FileText size={40} color="#d1d5db" />
            <Text className="mt-3 text-sm text-gray-500">Ingen dokumenter i denne mappen</Text>
          </View>
        ) : (
          <FlatList
            data={dokumenter}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingVertical: 4 }}
            renderItem={({ item }) => (
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
                    {item.processingState === "processing" && " — Prosesserer..."}
                    {item.processingState === "pending" && " — Venter..."}
                    {item.processingState === "failed" && " — Feilet"}
                  </Text>
                </View>
                {item.processingState === "completed" && (
                  <ChevronRight size={16} color="#9ca3af" />
                )}
                {item.processingState === "processing" && (
                  <ActivityIndicator size="small" color="#1e40af" />
                )}
              </TouchableOpacity>
            )}
          />
        )}
      </SafeAreaView>
    );
  }

  // Mappeliste
  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      <View className="border-b border-gray-200 bg-white px-4 py-3">
        <Text className="text-lg font-semibold text-gray-900">Mapper</Text>
      </View>
      {mapperLaster ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#1e40af" />
        </View>
      ) : synligeMapper.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <FolderOpen size={48} color="#9ca3af" />
          <Text className="mt-4 text-center text-sm text-gray-500">
            Ingen mapper i dette prosjektet
          </Text>
        </View>
      ) : (
        <FlatList
          data={synligeMapper}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingVertical: 4 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setÅpenMappe({ id: item.id, navn: item.name })}
              className="flex-row items-center border-b border-gray-100 bg-white px-4 py-3"
            >
              <Folder size={20} color="#1e40af" />
              <Text className="ml-3 flex-1 text-sm font-medium text-gray-900">
                {item.name}
              </Text>
              {item._count.ftdDocuments > 0 && (
                <Text className="mr-2 text-xs text-gray-400">
                  {item._count.ftdDocuments}
                </Text>
              )}
              <ChevronRight size={16} color="#9ca3af" />
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}
