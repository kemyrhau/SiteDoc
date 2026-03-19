import { Modal, View, Text, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
      <SafeAreaView className="flex-1 bg-[#1e40af]" edges={["top"]}>
        {/* Header */}
        <View className="flex-row items-center justify-between bg-[#1e40af] px-4 py-3">
          <Pressable onPress={onLukk} hitSlop={12}>
            <X size={22} color="#ffffff" />
          </Pressable>
          <Text className="flex-1 px-3 text-center text-sm font-semibold text-white" numberOfLines={1}>
            {tittel}
          </Text>
          <Pressable onPress={onDel} hitSlop={12} className="flex-row items-center gap-1.5">
            <Share2 size={18} color="#ffffff" />
            <Text className="text-sm font-medium text-white">Del</Text>
          </Pressable>
        </View>

        {/* WebView med HTML-forhåndsvisning */}
        {laster && (
          <View className="absolute inset-0 z-10 items-center justify-center bg-white" style={{ top: 52 }}>
            <ActivityIndicator size="large" color="#1e40af" />
            <Text className="mt-3 text-sm text-gray-500">Genererer forhåndsvisning...</Text>
          </View>
        )}
        <View className="flex-1 bg-gray-100 p-3">
          <View className="flex-1 overflow-hidden rounded-lg bg-white" style={{ shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4 }}>
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
