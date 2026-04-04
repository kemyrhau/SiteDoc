import { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
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
import { ANNOTERINGS_HTML } from "../assets/annoterings-html";
import { AUTH_CONFIG } from "../config/auth";

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
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [aktivtVerktoy, settAktivtVerktoy] = useState<Verktoy>("arrow");
  const [erKlar, settErKlar] = useState(false);
  const webViewRef = useRef<WebView>(null);

  // Tekst-input modal state
  const [visTekstModal, settVisTekstModal] = useState(false);
  const [tekstVerdi, settTekstVerdi] = useState("");
  const [tekstPosisjon, settTekstPosisjon] = useState({ x: 0, y: 0 });
  const [redigerIndeks, settRedigerIndeks] = useState<number | null>(null);

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

  const håndterTekstBekreft = useCallback(() => {
    const trimmet = tekstVerdi.trim();
    if (redigerIndeks != null) {
      // Oppdater eksisterende tekst (tom tekst = slett)
      sendMelding({
        type: "oppdaterTekst",
        indeks: redigerIndeks,
        tekst: trimmet,
      });
    } else if (trimmet) {
      // Ny tekst
      sendMelding({
        type: "plasserTekst",
        tekst: trimmet,
        x: tekstPosisjon.x,
        y: tekstPosisjon.y,
      });
    }
    settVisTekstModal(false);
    settTekstVerdi("");
    settRedigerIndeks(null);
  }, [tekstVerdi, tekstPosisjon, redigerIndeks, sendMelding]);

  const håndterTekstAvbryt = useCallback(() => {
    settVisTekstModal(false);
    settTekstVerdi("");
    settRedigerIndeks(null);
  }, []);

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
          const filsti = `${FileSystem.cacheDirectory}annotert_${Date.now()}.png`;
          await FileSystem.writeAsStringAsync(filsti, base64Data, {
            encoding: FileSystem.EncodingType.Base64,
          });
          onFerdig(filsti);
        } else if (data.type === "tekstInput") {
          settTekstPosisjon({ x: data.x, y: data.y });
          settTekstVerdi("");
          settRedigerIndeks(null);
          settVisTekstModal(true);
        } else if (data.type === "redigerTekst") {
          settTekstVerdi(data.tekst as string);
          settRedigerIndeks(data.indeks as number);
          settVisTekstModal(true);
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
        <Text className="text-base font-semibold text-white">Annoter bilde</Text>
        <Pressable
          onPress={() => sendMelding({ type: "lagre" })}
          disabled={!erKlar}
          hitSlop={16}
          className="min-w-[60px] items-end py-2"
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
              {label}
            </Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => sendMelding({ type: "angre" })}
          hitSlop={4}
          className="items-center rounded-lg px-3 py-2"
        >
          <Undo2 size={22} color="#9ca3af" />
          <Text className="mt-0.5 text-[10px] text-gray-400">Angre</Text>
        </Pressable>
      </View>

      {/* Tekst-input modal */}
      {visTekstModal && (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="absolute inset-0 z-50 items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
        >
          <Pressable
            className="absolute inset-0"
            onPress={håndterTekstAvbryt}
          />
          <View className="mx-6 w-full max-w-sm rounded-xl bg-white p-5">
            <Text className="mb-3 text-base font-semibold text-gray-900">
              {redigerIndeks != null ? "Rediger tekst" : "Skriv inn tekst"}
            </Text>
            <TextInput
              autoFocus
              value={tekstVerdi}
              onChangeText={settTekstVerdi}
              placeholder="Skriv tekst her…"
              placeholderTextColor="#9ca3af"
              multiline
              className="mb-4 min-h-[80px] rounded-lg border border-gray-300 bg-gray-50 p-3 text-base text-gray-900"
              textAlignVertical="top"
              onSubmitEditing={håndterTekstBekreft}
              blurOnSubmit
            />
            <View className="flex-row justify-end gap-3">
              <Pressable
                onPress={håndterTekstAvbryt}
                hitSlop={8}
                className="rounded-lg px-4 py-2"
              >
                <Text className="text-sm font-medium text-gray-500">{t("handling.avbryt")}</Text>
              </Pressable>
              <Pressable
                onPress={håndterTekstBekreft}
                hitSlop={8}
                className="rounded-lg bg-blue-600 px-5 py-2"
              >
                <Text className="text-sm font-medium text-white">{t("handling.leggTil")}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}
