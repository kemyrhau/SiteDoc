import { useRouter } from "expo-router";
import { View, Text, ActivityIndicator, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, Box } from "lucide-react-native";
import { IfcViewer } from "../src/components/IfcViewer";
import { useProsjekt } from "../src/kontekst/ProsjektKontekst";
import { useBygning } from "../src/kontekst/BygningKontekst";
import { trpc } from "../src/lib/trpc";

export default function TreDVisningSkjerm() {
  const router = useRouter();
  const { valgtProsjektId } = useProsjekt();
  const { valgtBygningId } = useBygning();

  const { data: tegninger, isLoading } = trpc.tegning.hentForProsjekt.useQuery(
    {
      projectId: valgtProsjektId!,
      ...(valgtBygningId ? { buildingId: valgtBygningId } : {}),
    },
    { enabled: !!valgtProsjektId },
  );

  // Filtrer kun IFC-filer
  const ifcModeller = (tegninger ?? [])
    .filter((t: { fileType?: string }) => t.fileType?.toLowerCase() === "ifc")
    .map((t: { id: string; name: string; fileUrl: string; updatedAt?: string }) => ({
      id: t.id,
      name: t.name,
      fileUrl: t.fileUrl,
      updatedAt: t.updatedAt,
    }));

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f3f4f6" }} edges={["top"]}>
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#1e40af", paddingHorizontal: 12, paddingVertical: 10 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
            <ChevronLeft size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600", marginLeft: 4 }}>3D-visning</Text>
        </View>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color="#1e40af" />
          <Text style={{ marginTop: 12, color: "#6b7280", fontSize: 14 }}>Henter modeller...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (ifcModeller.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f3f4f6" }} edges={["top"]}>
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#1e40af", paddingHorizontal: 12, paddingVertical: 10 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
            <ChevronLeft size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600", marginLeft: 4 }}>3D-visning</Text>
        </View>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 }}>
          <Box size={48} color="#9ca3af" />
          <Text style={{ color: "#6b7280", fontSize: 16, fontWeight: "500", marginTop: 16 }}>
            Ingen IFC-modeller
          </Text>
          <Text style={{ color: "#9ca3af", fontSize: 13, textAlign: "center", marginTop: 6 }}>
            Velg en bygning med 3D-modeller i Lokasjoner
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <IfcViewer
      modeller={ifcModeller}
      onTilbake={() => router.back()}
    />
  );
}
