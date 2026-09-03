import { Modal, View, Text, Pressable, ActivityIndicator } from "react-native";
import { ModalFlate } from "./ModalFlate";
import { WebView } from "react-native-webview";
import { X, Share2 } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";

interface ArkivPdfForhandsvisningProps {
  synlig: boolean;
  /** file://-URI til den server-rendrede arkiv-PDF-en (i cacheDirectory). */
  filUri: string | null;
  tittel: string;
  onDel: () => void;
  onLukk: () => void;
}

/**
 * Funn E: forhåndsvis den server-rendrede arkiv-PDF-en (`arkiv.rendr`) INNE i
 * appen — kontroll før sending, ikke bare deling. Viser den ferdige PDF-fila
 * (samme motor som web, base64 → cacheDirectory) i en WebView. Bruker IKKE
 * expo-print/lokal HTML-bygging — den veien ble bevisst fjernet (2026-08-23,
 * `0188b6b6`) fordi telefonen uansett må være på nett for å hente bilder/
 * tegninger. Del-knappen beholdes (deler den samme fila).
 */
export function ArkivPdfForhandsvisning({
  synlig,
  filUri,
  tittel,
  onDel,
  onLukk,
}: ArkivPdfForhandsvisningProps) {
  const { t } = useTranslation();
  const [laster, settLaster] = useState(true);

  return (
    <Modal
      visible={synlig}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onLukk}
      onShow={() => settLaster(true)}
    >
      {/* ModalFlate padder fra useSafeAreaInsets() — <SafeAreaView> gir 0 padding
          inne i <Modal> (målt 2026-08-31), som la lukk/del-knappene under Dynamic
          Island. bg-[#1e40af] gjenskaper den blå flaten bak top/bottom-insettene. */}
      <ModalFlate kanter={["top", "bottom"]} className="bg-[#1e40af]">
        {/* Header: lukk · tittel · del */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "#1e40af",
            paddingHorizontal: 16,
            paddingVertical: 12,
          }}
        >
          <Pressable onPress={onLukk} hitSlop={12}>
            <X size={22} color="#ffffff" />
          </Pressable>
          <Text
            style={{ flex: 1, paddingHorizontal: 12, textAlign: "center", fontSize: 14, fontWeight: "600", color: "#ffffff" }}
            numberOfLines={1}
          >
            {tittel}
          </Text>
          <Pressable onPress={onDel} hitSlop={12} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Share2 size={18} color="#ffffff" />
            <Text style={{ fontSize: 14, fontWeight: "500", color: "#ffffff" }}>{t("arkiv.del")}</Text>
          </Pressable>
        </View>

        {/* PDF-visning */}
        <View style={{ flex: 1, backgroundColor: "#f3f4f6" }}>
          {laster && (
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 10,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#f3f4f6",
              }}
            >
              <ActivityIndicator size="large" color="#1e40af" />
              <Text style={{ marginTop: 12, fontSize: 13, color: "#6b7280" }}>
                {t("arkiv.lasterForhandsvisning")}
              </Text>
            </View>
          )}
          {filUri && (
            <WebView
              source={{ uri: filUri }}
              originWhitelist={["*"]}
              allowFileAccess
              allowFileAccessFromFileURLs
              onLoadEnd={() => settLaster(false)}
              style={{ flex: 1 }}
            />
          )}
        </View>
      </ModalFlate>
    </Modal>
  );
}
