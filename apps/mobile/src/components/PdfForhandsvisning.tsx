import { Modal, View, Text, Pressable, ActivityIndicator, SafeAreaView } from "react-native";
import { WebView } from "react-native-webview";
import { X, Share2 } from "lucide-react-native";
import { useState } from "react";

interface PdfForhandsvisningProps {
  synlig: boolean;
  html: string;
  tittel: string;
  onDel: () => void;
  onLukk: () => void;
}

export function PdfForhandsvisning({
  synlig,
  html,
  tittel,
  onDel,
  onLukk,
}: PdfForhandsvisningProps) {
  const [laster, settLaster] = useState(true);

  return (
    <Modal
      visible={synlig}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onLukk}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: "#1e40af" }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#1e40af", paddingHorizontal: 16, paddingVertical: 12 }}>
          <Pressable onPress={onLukk} hitSlop={12}>
            <X size={22} color="#ffffff" />
          </Pressable>
          <Text style={{ flex: 1, paddingHorizontal: 12, textAlign: "center", fontSize: 14, fontWeight: "600", color: "#ffffff" }} numberOfLines={1}>
            {tittel}
          </Text>
          <Pressable onPress={onDel} hitSlop={12} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Share2 size={18} color="#ffffff" />
            <Text style={{ fontSize: 14, fontWeight: "500", color: "#ffffff" }}>Del</Text>
          </Pressable>
        </View>

        {/* WebView med HTML-forhåndsvisning */}
        <View style={{ flex: 1, backgroundColor: "#f3f4f6", padding: 12 }}>
          {laster && (
            <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#f3f4f6" }}>
              <ActivityIndicator size="large" color="#1e40af" />
              <Text style={{ marginTop: 12, fontSize: 13, color: "#6b7280" }}>Genererer forhåndsvisning...</Text>
            </View>
          )}
          <View style={{ flex: 1, borderRadius: 8, overflow: "hidden", backgroundColor: "#ffffff", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4 }}>
            <WebView
              source={{ html }}
              originWhitelist={["*"]}
              onLoadEnd={() => settLaster(false)}
              style={{ flex: 1 }}
              scalesPageToFit
              showsVerticalScrollIndicator
            />
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
