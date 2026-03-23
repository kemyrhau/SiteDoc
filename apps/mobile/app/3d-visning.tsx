import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, ActivityIndicator } from "react-native";
import { IfcViewer } from "../src/components/IfcViewer";
import { useProsjekt } from "../src/kontekst/ProsjektKontekst";
import { trpc } from "../src/lib/trpc";

export default function TreDVisningSkjerm() {
  const router = useRouter();
  const { valgtProsjektId } = useProsjekt();

  const { data: tegninger, isLoading } = trpc.tegning.hentForProsjekt.useQuery(
    { projectId: valgtProsjektId! },
    { enabled: !!valgtProsjektId },
  );

  // Filtrer kun IFC-filer
  const ifcModeller = (tegninger ?? [])
    .filter((t: { fileType?: string }) => t.fileType?.toLowerCase() === "ifc")
    .map((t: { id: string; name: string; fileUrl: string }) => ({
      id: t.id,
      name: t.name,
      fileUrl: t.fileUrl,
    }));

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f3f4f6" }}>
        <ActivityIndicator size="large" color="#1e40af" />
        <Text style={{ marginTop: 12, color: "#6b7280", fontSize: 14 }}>Henter modeller...</Text>
      </View>
    );
  }

  if (ifcModeller.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f3f4f6" }}>
        <Text style={{ color: "#9ca3af", fontSize: 16 }}>Ingen IFC-modeller i prosjektet</Text>
      </View>
    );
  }

  return (
    <IfcViewer
      modeller={ifcModeller}
      onTilbake={() => router.back()}
    />
  );
}
