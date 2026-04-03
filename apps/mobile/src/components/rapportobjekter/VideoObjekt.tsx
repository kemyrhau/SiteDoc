import { useState, useRef, useCallback } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { Play, RotateCcw } from "lucide-react-native";
import type { RapportObjektProps } from "./typer";
import { hentWebUrl } from "../../config/auth";

/** Video-avspiller for PSI — sporer avspillingsprogresjon */
export function VideoObjekt({ objekt, onEndreVerdi }: RapportObjektProps) {
  const url = (objekt.config.url as string) ?? (objekt.config.fileUrl as string) ?? "";
  const [erFerdig, setErFerdig] = useState(false);
  const [harStartet, setHarStartet] = useState(false);

  const baseUrl = hentWebUrl();
  const fullUrl = url.startsWith("http") ? url : `${baseUrl}/api${url}`;

  const player = useVideoPlayer(fullUrl, (p) => {
    p.loop = false;
  });

  // Lytt på status-endringer
  const sjekkFerdig = useCallback(() => {
    if (player.status === "idle" && harStartet) {
      setErFerdig(true);
      onEndreVerdi("watched");
    }
  }, [player.status, harStartet, onEndreVerdi]);

  // Sjekk status periodisk
  if (player.status === "idle" && harStartet && !erFerdig) {
    sjekkFerdig();
  }

  if (!url) {
    return (
      <View className="my-3 items-center rounded-lg border border-gray-200 bg-gray-50 p-6">
        <Text className="text-sm text-gray-400">Ingen video konfigurert</Text>
      </View>
    );
  }

  return (
    <View className="my-3">
      <View className="overflow-hidden rounded-lg border border-gray-200">
        <VideoView
          player={player}
          style={{ width: "100%", aspectRatio: 16 / 9 }}
        />
      </View>

      {!harStartet && (
        <TouchableOpacity
          onPress={() => { player.play(); setHarStartet(true); }}
          className="mt-2 flex-row items-center justify-center gap-2 rounded-lg bg-sitedoc-primary py-2.5"
        >
          <Play size={18} color="#ffffff" />
          <Text className="text-sm font-medium text-white">Spill av video</Text>
        </TouchableOpacity>
      )}

      {erFerdig && (
        <View className="mt-2 flex-row items-center justify-center gap-2">
          <Text className="text-sm text-green-600">✓ Video fullført</Text>
          <TouchableOpacity
            onPress={() => { player.replay(); setErFerdig(false); }}
            className="flex-row items-center gap-1 rounded-lg px-2 py-1"
          >
            <RotateCcw size={14} color="#6b7280" />
            <Text className="text-xs text-gray-500">Se igjen</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
