import { View, Text } from "react-native";

export function HjemSkjerm() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 16 }}>
      <Text style={{ fontSize: 32, fontWeight: "bold", color: "#1e40af", marginBottom: 8 }}>
        SiteFlow
      </Text>
      <Text style={{ fontSize: 16, color: "#6b7280" }}>
        Rapport- og kvalitetsstyring for byggeprosjekter
      </Text>
    </View>
  );
}
