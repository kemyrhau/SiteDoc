import { useState, useRef, useCallback } from "react";
import { View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import * as FileSystem from "expo-file-system/legacy";
import { useTranslation } from "react-i18next";
import { ANNOTERINGS_HTML } from "@sitedoc/shared";
import { AUTH_CONFIG } from "../config/auth";

type Verktoy = "arrow" | "circle" | "rect" | "draw" | "text";

interface BildeAnnoteringProps {
  bildeUri: string;
  onFerdig: (annotertBildeUri: string) => void;
  onAvbryt: () => void;
}

// labelKey (ikke label): arrayet lever utenfor komponenten, så t() kalles ved
// rendering — i18n-standarden for data utenfor komponenter.
const VERKTOYER: { id: Verktoy; ikon: typeof ArrowUpRight; labelKey: string }[] = [
  { id: "arrow", ikon: ArrowUpRight, labelKey: "annotering.verktoy.pil" },
  { id: "circle", ikon: Circle, labelKey: "annotering.verktoy.sirkel" },
  { id: "rect", ikon: Square, labelKey: "annotering.verktoy.firkant" },
  { id: "draw", ikon: Pencil, labelKey: "annotering.verktoy.frihand" },
  { id: "text", ikon: Type, labelKey: "annotering.verktoy.tekst" },
];

export function BildeAnnotering({ bildeUri, onFerdig, onAvbryt }: BildeAnnoteringProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
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

  // Tekst skrives nå DIREKTE på bildet (fabric.IText i den delte HTML-en) — ingen modal,
  // ingen tekstInput/plasserTekst-meldinger over broen. WebView-tastaturet åpnes når
  // IText går i redigering.
  const håndterMelding = useCallback(
    async (e: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(e.nativeEvent.data);
        if (data.type === "klar") {
          settErKlar(true);
          let lokalSti = bildeUri;
          // Server-URL → last ned til lokal fil først
          if (bildeUri.startsWith("/") || bildeUri.startsWith("http")) {
            const fullUrl = bildeUri.startsWith("/") ? `${AUTH_CONFIG.apiUrl}${bildeUri}` : bildeUri;
            lokalSti = `${FileSystem.cacheDirectory}annoterings_kilde_${Date.now()}.jpg`;
            await FileSystem.downloadAsync(fullUrl, lokalSti);
          }
          const base64 = await FileSystem.readAsStringAsync(lokalSti, {
            encoding: FileSystem.EncodingType.Base64,
          });
          sendMelding({ type: "settBilde", bildeUrl: `data:image/jpeg;base64,${base64}` });
        } else if (data.type === "ferdig" && data.dataUrl) {
          const base64Data = (data.dataUrl as string).split(",")[1];
          // .jpg — annoteringen eksporteres nå som JPEG (annoterings-html.ts), ikke PNG.
          const filsti = `${FileSystem.cacheDirectory}annotert_${Date.now()}.jpg`;
          await FileSystem.writeAsStringAsync(filsti, base64Data, {
            encoding: FileSystem.EncodingType.Base64,
          });
          onFerdig(filsti);
        }
      } catch {
        // Ignorer ugyldig melding
      }
    },
    [bildeUri, sendMelding, onFerdig],
  );

  return (
    <View
      className="flex-1 bg-black"
      style={{
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between bg-gray-900 px-6 py-3">
        <Pressable onPress={onAvbryt} hitSlop={16} className="min-w-[60px] py-2">
          <Text className="text-base text-gray-400">{t("handling.avbryt")}</Text>
        </Pressable>
        <Text className="text-base font-semibold text-white">{t("annotering.tittel")}</Text>
        <Pressable
          onPress={() => sendMelding({ type: "lagre" })}
          disabled={!erKlar}
          hitSlop={16}
          className="min-w-[60px] items-end py-2"
        >
          <Text className={`text-base font-semibold ${erKlar ? "text-blue-400" : "text-gray-600"}`}>
            {t("handling.ferdig")}
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
        {VERKTOYER.map(({ id, ikon: Ikon, labelKey }) => (
          <Pressable
            key={id}
            onPress={() => håndterVerktoybytte(id)}
            hitSlop={4}
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
              {t(labelKey)}
            </Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => sendMelding({ type: "angre" })}
          hitSlop={4}
          className="items-center rounded-lg px-3 py-2"
        >
          <Undo2 size={22} color="#9ca3af" />
          <Text className="mt-0.5 text-[10px] text-gray-400">{t("annotering.angre")}</Text>
        </Pressable>
      </View>
    </View>
  );
}
