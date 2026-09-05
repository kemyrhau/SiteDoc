import { useState, useRef, useCallback } from "react";
import { View, Text, Pressable } from "react-native";
import { WebView } from "react-native-webview";
import type { WebViewMessageEvent } from "react-native-webview";
import { PenLine, RotateCcw, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { lesSignaturVerdi, formaterSignaturLinje, signaturTidspunktNaa } from "@sitedoc/shared";
import type { RapportObjektProps } from "./typer";
import { SIGNATUR_HTML } from "../../assets/signatur-html";
import { useAuth } from "../../providers/AuthProvider";

export function SignaturObjekt({ verdi, onEndreVerdi, leseModus }: RapportObjektProps) {
  const { t } = useTranslation();
  const { bruker } = useAuth();
  const [redigerer, settRedigerer] = useState(false);
  const webViewRef = useRef<WebView>(null);
  const signatur = lesSignaturVerdi(verdi);
  const metaLinje = signatur ? formaterSignaturLinje(signatur) : null;

  const håndterMelding = useCallback(
    (e: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(e.nativeEvent.data);
        if (data.type === "signatur") {
          // Snapshot av hvem/når fanges i signeringsøyeblikket (fabel-vedtak 05.09).
          onEndreVerdi({
            dataUrl: data.dataUrl,
            brukerId: bruker?.id ?? null,
            navn: bruker?.name ?? null,
            tidspunkt: signaturTidspunktNaa(),
          });
          settRedigerer(false);
        }
      } catch {
        // Ignorer ugyldig melding
      }
    },
    [onEndreVerdi, bruker],
  );

  // Lesemodus uten signatur → ingen tegneflate.
  if (leseModus && !signatur) {
    return (
      <View className="items-center rounded-lg border border-gray-200 bg-gray-50 py-6">
        <Text className="text-sm text-gray-400">{t("felt.ingenSignatur")}</Text>
      </View>
    );
  }

  // Har signatur, ikke i redigering → bildet + meta-linje (uendret bilde-tilstand).
  if (!redigerer && signatur) {
    return (
      <View>
        <View className="items-center rounded-lg border border-gray-200 bg-white p-2">
          <WebView
            source={{ html: `<html><body style="margin:0;display:flex;align-items:center;justify-content:center"><img src="${signatur.dataUrl}" style="max-width:100%;max-height:100%"/></body></html>` }}
            style={{ height: 120, width: "100%" }}
            scrollEnabled={false}
          />
          {metaLinje && <Text className="mt-1 text-xs text-gray-500">{metaLinje}</Text>}
        </View>
        {!leseModus && (
          <Pressable
            // Åpner tegneflaten UTEN å slette dagens signatur — avbryt beholder den (krav 2).
            onPress={() => settRedigerer(true)}
            className="mt-2 flex-row items-center justify-center gap-1"
          >
            <RotateCcw size={14} color="#6b7280" />
            <Text className="text-sm text-gray-500">{t("felt.signerPaaNytt")}</Text>
          </Pressable>
        )}
      </View>
    );
  }

  // Tredje tilstand: tom og LUKKET → «Signer her»-knapp (≥44px trykkflate), ingen touch-felle.
  if (!redigerer && !signatur) {
    return (
      <Pressable
        onPress={() => settRedigerer(true)}
        className="min-h-[44px] flex-row items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 py-3"
      >
        <PenLine size={16} color="#4b5563" />
        <Text className="text-sm font-medium text-gray-600">{t("felt.signerHer")}</Text>
      </Pressable>
    );
  }

  // Redigerer → tegneflaten (Tøm · Avbryt · Lagre).
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
          <Text className="text-sm text-gray-600">{t("felt.tom")}</Text>
        </Pressable>
        <Pressable
          // Lukking lagrer ingenting (avbrytbarhets-regelen). Har feltet en signatur fra før, står den urørt.
          onPress={() => settRedigerer(false)}
          className="flex-row items-center gap-1 rounded-lg border border-gray-300 px-3 py-2"
        >
          <X size={14} color="#6b7280" />
          <Text className="text-sm text-gray-600">{t("handling.avbryt")}</Text>
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
