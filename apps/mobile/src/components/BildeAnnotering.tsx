import { useState, useRef, useCallback } from "react";
import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import type { WebViewMessageEvent } from "react-native-webview";
import {
  ArrowUpRight,
  Circle,
  Square,
  Pencil,
  Type,
  Undo2,
} from "lucide-react-native";
import { File, Paths } from "expo-file-system";
import { ANNOTERINGS_HTML } from "../assets/annoterings-html";

type Verktoy = "arrow" | "circle" | "rect" | "draw" | "text";

interface BildeAnnoteringProps {
  bildeUri: string;
  onFerdig: (annotertBildeUri: string) => void;
  onAvbryt: () => void;
}

const VERKTOYER: { id: Verktoy; ikon: typeof ArrowUpRight; label: string }[] = [
  { id: "arrow", ikon: ArrowUpRight, label: "Pil" },
  { id: "circle", ikon: Circle, label: "Sirkel" },
  { id: "rect", ikon: Square, label: "Firkant" },
  { id: "draw", ikon: Pencil, label: "Frihånd" },
  { id: "text", ikon: Type, label: "Tekst" },
];

export function BildeAnnotering({ bildeUri, onFerdig, onAvbryt }: BildeAnnoteringProps) {
  const [aktivtVerktoy, settAktivtVerktoy] = useState<Verktoy>("arrow");
  const [erKlar, settErKlar] = useState(false);
  const webViewRef = useRef<WebView>(null);

  const sendMelding = useCallback(
    (melding: Record<string, unknown>) => {
      webViewRef.current?.postMessage(JSON.stringify(melding));
    },
    [],
  );

  const håndterVerktoybytte = useCallback(
    (verktoy: Verktoy) => {
      settAktivtVerktoy(verktoy);
      sendMelding({ type: "velgVerktoy", verktoy });
    },
    [sendMelding],
  );

  const håndterMelding = useCallback(
    async (e: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(e.nativeEvent.data);
        if (data.type === "klar") {
          settErKlar(true);
          // Send bildet til WebView — les filen som base64
          const kildeFil = new File(bildeUri);
          const base64 = await kildeFil.base64();
          sendMelding({ type: "settBilde", bildeUrl: `data:image/jpeg;base64,${base64}` });
        } else if (data.type === "ferdig" && data.dataUrl) {
          // Lagre annotert bilde lokalt
          const base64Data = (data.dataUrl as string).split(",")[1];
          const målFil = new File(Paths.cache, `annotert_${Date.now()}.png`);
          målFil.create();
          målFil.write(base64Data, { encoding: "base64" });
          onFerdig(målFil.uri);
        }
      } catch {
        // Ignorer ugyldig melding
      }
    },
    [bildeUri, sendMelding, onFerdig],
  );

  return (
    <SafeAreaView className="flex-1 bg-black">
      {/* Header */}
      <View className="flex-row items-center justify-between bg-gray-900 px-4 py-3">
        <Pressable onPress={onAvbryt}>
          <Text className="text-base text-gray-400">Avbryt</Text>
        </Pressable>
        <Text className="text-base font-semibold text-white">Annoter bilde</Text>
        <Pressable
          onPress={() => sendMelding({ type: "lagre" })}
          disabled={!erKlar}
        >
          <Text className={`text-base font-semibold ${erKlar ? "text-blue-400" : "text-gray-600"}`}>
            Ferdig
          </Text>
        </Pressable>
      </View>

      {/* WebView med Fabric.js */}
      <View className="flex-1">
        <WebView
          ref={webViewRef}
          source={{ html: ANNOTERINGS_HTML }}
          style={{ flex: 1 }}
          scrollEnabled={false}
          onMessage={håndterMelding}
          allowFileAccess
        />
      </View>

      {/* Verktøylinje */}
      <View className="flex-row items-center justify-around bg-gray-900 px-4 py-3">
        {VERKTOYER.map(({ id, ikon: Ikon, label }) => (
          <Pressable
            key={id}
            onPress={() => håndterVerktoybytte(id)}
            className={`items-center rounded-lg px-3 py-2 ${
              aktivtVerktoy === id ? "bg-blue-600" : ""
            }`}
          >
            <Ikon size={22} color={aktivtVerktoy === id ? "#ffffff" : "#9ca3af"} />
            <Text
              className={`mt-0.5 text-[10px] ${
                aktivtVerktoy === id ? "text-white" : "text-gray-400"
              }`}
            >
              {label}
            </Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => sendMelding({ type: "angre" })}
          className="items-center rounded-lg px-3 py-2"
        >
          <Undo2 size={22} color="#9ca3af" />
          <Text className="mt-0.5 text-[10px] text-gray-400">Angre</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
