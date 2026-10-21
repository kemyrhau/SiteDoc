import { useState, useRef, useCallback, useEffect } from "react";
import { View, Text, Pressable, Keyboard, Platform, useWindowDimensions } from "react-native";
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
import { lagAnnoteringsHtml, annoteringsflateHoyde } from "@sitedoc/shared";
import { AUTH_CONFIG } from "../config/auth";

// Mobil forankrer bildet ØVERST (befaring-funn A): fast posisjon rett under
// overskriften, bildet står stille med og uten tastatur. Web bruker standarden
// "senter" (SVAR dc6b8090 — web uendret). HTML-en er statisk; bygges én gang.
const MOBIL_ANNOTERINGS_HTML = lagAnnoteringsHtml({ anker: "topp" });

type Verktoy = "arrow" | "circle" | "rect" | "draw" | "text";

// Befaring-funn A (Kenneth 2026-10-21): bildet skal stå FAST, med og uten tastatur, forankret
// rett under overskriftslinja. WebView-flaten får derfor en fast høyde der tastaturhøyden
// ALLTID er reservert — da hopper bildet aldri. Overskriften har fast høyde (ingen måling som
// kan gi et etter-mount-hopp), og vi legger ~16 pt luft over tastaturet (Kenneths tall).
const HEADER_HOYDE = 52;
const LUFT_OVER_TASTATUR = 16;
// Reservert tastaturhøyde (full, inkl. prediktiv linje) når ingen måling finnes ennå.
const STANDARD_TASTATUR = Platform.OS === "ios" ? 336 : 300;
// Siste MÅLTE tastaturhøyde — caches på modulnivå så neste annoteringsøkt treffer enda bedre.
// Oppdateres av lytteren UTEN å endre den pågående øktas flate (unngår hopp midt i økta).
let sisteMalteTastaturHoyde: number | null = null;

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
  const { height: vindusHoyde } = useWindowDimensions();
  const [aktivtVerktoy, settAktivtVerktoy] = useState<Verktoy>("arrow");
  const [erKlar, settErKlar] = useState(false);
  const webViewRef = useRef<WebView>(null);

  // Befaring-funn A (Kenneth 2026-10-21): fast bildeposisjon. Flatehøyden beregnes ÉN gang
  // ved mount — tastaturhøyden reserveres ALLTID — så bildet står stille enten tastaturet er
  // fremme eller ikke. Vi translaterer/skalerer ikke lenger WebView-en når tastaturet kommer;
  // det native tastaturet legger seg over den reserverte sonen nederst (verktøylinje + svart
  // felt), aldri over bildet. Reservasjonen fanges i en ref så en senere måling ikke endrer
  // den PÅGÅENDE øktas flate (det ville vært et hopp).
  const reservertTastaturRef = useRef(sisteMalteTastaturHoyde ?? STANDARD_TASTATUR);
  const flateHoyde = annoteringsflateHoyde({
    vindusHoyde,
    insetTop: insets.top,
    headerHoyde: HEADER_HOYDE,
    tastaturHoyde: reservertTastaturRef.current,
    hjelpelinjeHoyde: LUFT_OVER_TASTATUR,
  });

  // Lytt KUN for å cache den målte tastaturhøyden til neste økt — endrer ikke flaten nå.
  useEffect(() => {
    const abo = Keyboard.addListener("keyboardDidShow", (e) => {
      const h = e.endCoordinates?.height ?? 0;
      if (h > 0) sisteMalteTastaturHoyde = h;
    });
    return () => abo.remove();
  }, []);

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
      {/* Header — fast høyde (befaring-funn A): alltid synlig, aldri dekket av tastaturet,
          og flaten under beregnes mot denne faste høyden så bildet ikke hopper. */}
      <View className="flex-row items-center justify-between bg-gray-900 px-6" style={{ height: HEADER_HOYDE }}>
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

      {/* WebView med Fabric.js — FAST høyde (befaring-funn A): bildet forankres rett under
          header og står stille med og uten tastatur. Tastaturet legger seg over den reserverte
          sonen nederst (spacer + verktøylinje), aldri over bildet. */}
      <View style={{ height: flateHoyde }}>
        <WebView
          ref={webViewRef}
          source={{ html: MOBIL_ANNOTERINGS_HTML }}
          style={{ flex: 1 }}
          scrollEnabled={false}
          onMessage={håndterMelding}
          allowFileAccess
        />
      </View>

      {/* Svart fyll ned til verktøylinja — denne sonen dekkes av tastaturet når det er fremme. */}
      <View className="flex-1 bg-black" />

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
