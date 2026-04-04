import { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { WebView } from "react-native-webview";
import { Play, RotateCcw } from "lucide-react-native";
import type { RapportObjektProps } from "./typer";
import { hentWebUrl } from "../../config/auth";

/** Video-avspiller via WebView (ingen native modul nødvendig) */
export function VideoObjekt({ objekt, verdi, onEndreVerdi }: RapportObjektProps) {
  const url = (objekt.config.url as string) ?? (objekt.config.fileUrl as string) ?? "";
  const [erFerdig, setErFerdig] = useState(verdi === "watched");
  const [harStartet, setHarStartet] = useState(false);

  const baseUrl = hentWebUrl();
  const fullUrl = url.startsWith("http") ? url : `${baseUrl}/api${url}`;

  if (!url) {
    return (
      <View className="my-3 items-center rounded-lg border border-gray-200 bg-gray-50 p-6">
        <Text className="text-sm text-gray-400">Ingen video konfigurert</Text>
      </View>
    );
  }

  const html = `
    <!DOCTYPE html>
    <html><head>
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #000; display: flex; align-items: center; justify-content: center; height: 100vh; }
        video { width: 100%; max-height: 100vh; }
      </style>
    </head><body>
      <video id="v" src="${fullUrl}" controls playsinline></video>
      <script>
        const v = document.getElementById("v");
        v.addEventListener("ended", () => {
          window.ReactNativeWebView.postMessage("ended");
        });
        v.addEventListener("timeupdate", () => {
          if (v.duration > 0 && v.currentTime / v.duration > 0.9) {
            window.ReactNativeWebView.postMessage("almost_done");
          }
        });
      </script>
    </body></html>
  `;

  return (
    <View className="my-3">
      {harStartet ? (
        <View className="overflow-hidden rounded-lg border border-gray-200" style={{ height: 220 }}>
          <WebView
            source={{ html }}
            style={{ flex: 1 }}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            onMessage={(e) => {
              if (e.nativeEvent.data === "ended" || e.nativeEvent.data === "almost_done") {
                if (!erFerdig) {
                  setErFerdig(true);
                  onEndreVerdi("watched");
                }
              }
            }}
          />
        </View>
      ) : (
        <TouchableOpacity
          onPress={() => setHarStartet(true)}
          className="items-center justify-center rounded-lg border border-gray-200 bg-gray-900"
          style={{ height: 220 }}
        >
          <Play size={48} color="#ffffff" />
          <Text className="mt-2 text-sm text-white">Trykk for å spille av</Text>
        </TouchableOpacity>
      )}

      {erFerdig && (
        <View className="mt-2 flex-row items-center justify-center gap-2">
          <Text className="text-sm text-green-600">✓ Video fullført</Text>
          <TouchableOpacity
            onPress={() => { setErFerdig(false); setHarStartet(false); }}
            className="flex-row items-center gap-1"
          >
            <RotateCcw size={14} color="#6b7280" />
            <Text className="text-xs text-gray-500">Se igjen</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
