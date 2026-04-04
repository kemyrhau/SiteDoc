import { useState, useRef, useCallback } from "react";
import { View, Text, Pressable } from "react-native";
import { WebView } from "react-native-webview";
import type { WebViewMessageEvent } from "react-native-webview";
import { PenLine, RotateCcw } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import type { RapportObjektProps } from "./typer";
import { SIGNATUR_HTML } from "../../assets/signatur-html";

export function SignaturObjekt({ verdi, onEndreVerdi, leseModus }: RapportObjektProps) {
  const { t } = useTranslation();
  const [redigerer, settRedigerer] = useState(false);
  const webViewRef = useRef<WebView>(null);
  const harSignatur = typeof verdi === "string" && verdi.length > 0;

  const håndterMelding = useCallback(
    (e: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(e.nativeEvent.data);
        if (data.type === "signatur") {
          onEndreVerdi(data.dataUrl);
          settRedigerer(false);
        }
      } catch {
        // Ignorer ugyldig melding
      }
    },
    [onEndreVerdi],
  );

  if (leseModus && !harSignatur) {
    return (
      <View className="items-center rounded-lg border border-gray-200 bg-gray-50 py-6">
        <Text className="text-sm text-gray-400">Ingen signatur</Text>
      </View>
    );
  }

  if (!redigerer && harSignatur) {
    return (
      <View>
        <View className="items-center rounded-lg border border-gray-200 bg-white p-2">
          <WebView
            source={{ html: `<html><body style="margin:0;display:flex;align-items:center;justify-content:center"><img src="${verdi}" style="max-width:100%;max-height:100%"/></body></html>` }}
            style={{ height: 120, width: "100%" }}
            scrollEnabled={false}
          />
        </View>
        {!leseModus && (
          <Pressable
            onPress={() => {
              onEndreVerdi(null);
              settRedigerer(true);
            }}
            className="mt-2 flex-row items-center justify-center gap-1"
          >
            <RotateCcw size={14} color="#6b7280" />
            <Text className="text-sm text-gray-500">Signer på nytt</Text>
          </Pressable>
        )}
      </View>
    );
  }

  if (redigerer || !harSignatur) {
    return (
      <View>
        <View className="overflow-hidden rounded-lg border border-gray-300">
          <WebView
            ref={webViewRef}
            source={{ html: SIGNATUR_HTML }}
            style={{ height: 200 }}
            scrollEnabled={false}
            onMessage={håndterMelding}
          />
        </View>
        <View className="mt-2 flex-row justify-end gap-3">
          <Pressable
            onPress={() => webViewRef.current?.injectJavaScript("tømCanvas(); true;")}
            className="flex-row items-center gap-1 rounded-lg border border-gray-300 px-3 py-2"
          >
            <RotateCcw size={14} color="#6b7280" />
            <Text className="text-sm text-gray-600">Tøm</Text>
          </Pressable>
          <Pressable
            onPress={() => webViewRef.current?.injectJavaScript("lagreSignatur(); true;")}
            className="flex-row items-center gap-1 rounded-lg bg-blue-600 px-4 py-2"
          >
            <PenLine size={14} color="#ffffff" />
            <Text className="text-sm font-medium text-white">{t("handling.lagre")}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return null;
}
