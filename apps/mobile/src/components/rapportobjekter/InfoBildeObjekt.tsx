import { useState } from "react";
import { View, Text, Image, TouchableOpacity, Modal, ScrollView, SafeAreaView, useWindowDimensions } from "react-native";
import { X } from "lucide-react-native";
import type { RapportObjektProps } from "./typer";
import { hentWebUrl } from "../../config/auth";

/** Bilde med caption (ikke redigerbar) — for PSI og instruksjoner */
export function InfoBildeObjekt({ objekt }: RapportObjektProps) {
  const bildeUrl = (objekt.config.imageUrl as string) ?? "";
  const caption = (objekt.config.caption as string) ?? "";
  const { width: skjermBredde } = useWindowDimensions();
  const [zoom, setZoom] = useState(false);

  if (!bildeUrl) return null;

  const baseUrl = hentWebUrl();
  const fullUrl = bildeUrl.startsWith("http") ? bildeUrl : `${baseUrl}/api${bildeUrl}`;
  const bredde = Math.min(skjermBredde - 32, 500);

  return (
    <>
      <TouchableOpacity onPress={() => setZoom(true)} className="my-3 items-center" activeOpacity={0.8}>
        <Image
          source={{ uri: fullUrl }}
          style={{ width: bredde, height: bredde * 0.65, borderRadius: 8 }}
          resizeMode="contain"
        />
        {caption ? (
          <Text className="mt-1.5 text-center text-xs italic text-gray-500">{caption}</Text>
        ) : null}
      </TouchableOpacity>

      <Modal visible={zoom} transparent animationType="fade">
        <View className="flex-1 bg-black">
          <SafeAreaView className="flex-1">
            <View className="flex-row items-center justify-end px-4 py-3">
              <TouchableOpacity onPress={() => setZoom(false)} hitSlop={12}>
                <X size={22} color="#ffffff" />
              </TouchableOpacity>
            </View>
            <ScrollView
              maximumZoomScale={5}
              minimumZoomScale={1}
              contentContainerStyle={{ flex: 1, justifyContent: "center", alignItems: "center" }}
              bouncesZoom
            >
              <Image
                source={{ uri: fullUrl }}
                style={{ width: skjermBredde, height: skjermBredde }}
                resizeMode="contain"
              />
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}
