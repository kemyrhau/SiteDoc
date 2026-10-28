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
import { trpc } from "../lib/trpc";
import { lastAnnoteringsbilde } from "../lib/annoteringsKilde";

// RETUR svart gjenåpning: en rå/utløpt server-URL fornyes ved å hente data på nytt (samme
// mekanisme som AutentisertBilde). Gir ikke det en signert URL innen fristen, vises en feil.
const MAKS_FORNYELSER = 3;
const FORNY_FRIST_MS = 8_000;

/** Bildets tilstand i flaten. Ferdig er bare aktiv når bildet faktisk er lastet. */
type BildeStatus = "laster" | "fornyer" | "klar" | "feil";

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
  /**
   * Bildet som annoteres. Kan endre seg mens flaten er åpen: en rå server-URL (rett etter
   * opplasting) byttes ut med den signerte når data er hentet på nytt — da lastes den.
   */
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
  const [bildeStatus, settBildeStatus] = useState<BildeStatus>("laster");
  const erKlar = bildeStatus === "klar";
  const webViewKlarRef = useRef(false);
  const fornyelserRef = useRef(0);
  const utils = trpc.useUtils();
  // Frys-fiks (orkestrator 2026-10-21): vis «Lagrer …» og deaktiver knappen FØR eksporten,
  // så brukeren ser at appen jobber mens den synkrone toDataURL kjører i WebView-en.
  const [lagrer, settLagrer] = useState(false);
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

  // Hent bildet og send det til WebView-en. Kilden avgjøres i lastAnnoteringsbilde (testet): lokal
  // fil leses, gyldig-signert server-URL lastes ned MED statussjekk, rå/utløpt URL fornyes først.
  const lastBilde = useCallback(
    async (uri: string) => {
      try {
        const r = await lastAnnoteringsbilde(uri, {
          apiUrl: AUTH_CONFIG.apiUrl,
          cacheDir: FileSystem.cacheDirectory ?? "",
          finnes: async (sti) => (await FileSystem.getInfoAsync(sti)).exists,
          lastNed: (url, tilSti) => FileSystem.downloadAsync(url, tilSti),
          lesBase64: (sti) => FileSystem.readAsStringAsync(sti, { encoding: FileSystem.EncodingType.Base64 }),
        });
        if (r.ok) {
          settBildeStatus("laster");
          sendMelding({ type: "settBilde", bildeUrl: r.dataUrl });
          return;
        }
        if (r.grunn === "trengerSignatur" && fornyelserRef.current < MAKS_FORNYELSER) {
          fornyelserRef.current += 1;
          settBildeStatus("fornyer");
          void utils.invalidate();
          return;
        }
        if (__DEV__) console.log(`[annotering] bildet kunne ikke lastes: ${r.grunn}${r.status ? ` (${r.status})` : ""}`);
        settBildeStatus("feil");
      } catch (feil) {
        if (__DEV__) console.log("[annotering] bildehenting feilet:", feil);
        settBildeStatus("feil");
      }
    },
    [sendMelding, utils],
  );

  // Tekst skrives nå DIREKTE på bildet (fabric.Textbox i den delte HTML-en) — ingen modal,
  // ingen tekstInput/plasserTekst-meldinger over broen. WebView-tastaturet åpnes når
  // tekstboksen går i redigering.
  const håndterMelding = useCallback(
    async (e: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(e.nativeEvent.data);
        if (data.type === "klar") {
          webViewKlarRef.current = true;
          await lastBilde(bildeUri);
        } else if (data.type === "bildeLastet") {
          settBildeStatus("klar");
        } else if (data.type === "bildeFeil") {
          // Bildet lot seg ikke dekode i WebView-en — aldri et stille svart lerret.
          settBildeStatus("feil");
        } else if (data.type === "ferdig" && data.dataUrl) {
          // Dev-logg av eksportstørrelse + tid (orkestrator iv) — gir Kenneths telefontest tall.
          if (__DEV__) {
            console.log(
              `[annotering] eksport: ${data.bytes} byte (q${data.kvalitet}), ${data.eksportMs} ms`,
            );
          }
          const base64Data = (data.dataUrl as string).split(",")[1];
          // .jpg — annoteringen eksporteres nå som JPEG (annoterings-html.ts), ikke PNG.
          // writeAsStringAsync er asynkron (native dekoding) → blokkerer ikke JS-tråden/navigeringen.
          const filsti = `${FileSystem.cacheDirectory}annotert_${Date.now()}.jpg`;
          await FileSystem.writeAsStringAsync(filsti, base64Data, {
            encoding: FileSystem.EncodingType.Base64,
          });
          onFerdig(filsti);
        } else if (data.type === "scrollKorrigert") {
          // Frys-fiks (RETUR 5965e37b): WKWebView forsøkte å scrolle lerretet ved tastaturet;
          // scroll-pinnen tilbakestilte det. Dev-signal gir Kenneths telefontest en bekreftelse.
          if (__DEV__) console.log("[annotering] WKWebView-scroll korrigert (frys-pin aktiv)");
        }
      } catch {
        // Ignorer ugyldig melding — nullstill «Lagrer …» så knappen ikke blir stående låst.
        settLagrer(false);
      }
    },
    [bildeUri, onFerdig, lastBilde],
  );

  // En fornyet (signert) URL fra kallstedet mens vi venter → last den.
  useEffect(() => {
    if (webViewKlarRef.current && bildeStatus === "fornyer") void lastBilde(bildeUri);
    // Bare når URI-en endres; lastBilde selv styrer status.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bildeUri]);

  // Kom det ingen signert URL innen fristen → synlig feil (ikke evig «laster»).
  useEffect(() => {
    if (bildeStatus !== "fornyer") return;
    const frist = setTimeout(() => settBildeStatus((s) => (s === "fornyer" ? "feil" : s)), FORNY_FRIST_MS);
    return () => clearTimeout(frist);
  }, [bildeStatus]);

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
          onPress={() => {
            if (!erKlar || lagrer) return;
            settLagrer(true);
            sendMelding({ type: "lagre" });
          }}
          disabled={!erKlar || lagrer}
          hitSlop={16}
          className="min-w-[60px] items-end py-2"
        >
          <Text className={`text-base font-semibold ${erKlar && !lagrer ? "text-blue-400" : "text-gray-600"}`}>
            {lagrer ? t("handling.lagrer") : t("handling.ferdig")}
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
          // Frys-fiks (RETUR 5965e37b): hindre at WKWebView insetter/scroller for tastaturet.
          // Flaten ligger alt over tastaturet (reservert høyde), så enhver scroll dyttet bare
          // teksten ut av syne. Scroll-pinnen i HTML-en fanger resten (visualViewport).
          automaticallyAdjustContentInsets={false}
          contentInsetAdjustmentBehavior="never"
          onMessage={håndterMelding}
          allowFileAccess
        />
        {/* RETUR svart gjenåpning: flaten er aldri svart uten forklaring. Mens bildet hentes står
            «Laster bildet …»; feiler det, en forståelig feil (Ferdig er deaktivert til bildet er lastet). */}
        {bildeStatus !== "klar" && (
          <View
            pointerEvents="none"
            className="absolute inset-0 items-center justify-center bg-black px-8"
          >
            <Text className={`text-center text-base ${bildeStatus === "feil" ? "text-white" : "text-gray-400"}`}>
              {bildeStatus === "feil" ? t("annotering.bildeFeil") : t("annotering.lasterBilde")}
            </Text>
          </View>
        )}
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
