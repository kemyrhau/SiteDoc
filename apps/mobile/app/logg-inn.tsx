import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, Platform, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect } from "expo-router";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { useTranslation } from "react-i18next";
import { useAuth } from "../src/providers/AuthProvider";

WebBrowser.maybeCompleteAuthSession();

// Bygg reversed client ID for iOS redirect URI
// "xxx.apps.googleusercontent.com" → "com.googleusercontent.apps.xxx"
function lagReversertRedirectUri(iosClientId: string): string {
  const reversed = iosClientId.split(".").reverse().join(".");
  return `${reversed}:/oauthredirect`;
}

export default function LoggInnSkjerm() {
  const { t } = useTranslation();
  const { loggInnMedGoogle, loggInnMedMicrosoft, haandterOAuthCallback, erInnlogget, laster } = useAuth();
  const [feilmelding, setFeilmelding] = useState<string | null>(null);
  const harHaandtertResponse = useRef(false);

  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? "";

  // Google auth hook (brukes på native iOS/Android)
  const [googleRequest, googleResponse, googlePromptAsync] = Google.useAuthRequest({
    iosClientId,
    webClientId,
    redirectUri: Platform.OS === "ios" ? lagReversertRedirectUri(iosClientId) : undefined,
  });

  // Håndter Google-respons fra native OAuth-flyt
  useEffect(() => {
    if (!googleResponse) return;
    if (harHaandtertResponse.current) return;

    if (googleResponse.type === "success" && googleResponse.authentication?.accessToken) {
      harHaandtertResponse.current = true;
      setFeilmelding(null);
      haandterOAuthCallback("google", googleResponse.authentication.accessToken).catch((err) => {
        harHaandtertResponse.current = false;
        const melding = err instanceof Error ? err.message : t("feil.ukjentFeil");
        setFeilmelding(`${t("auth.apiTilkoblingFeil")}: ${melding}`);
        if (Platform.OS !== "web") {
          Alert.alert(t("auth.innloggingsfeil"), `${t("auth.apiTilkoblingFeil")}.\n\n${melding}`);
        }
      });
    } else if (googleResponse.type === "error") {
      setFeilmelding(googleResponse.error?.message ?? "Google-innlogging feilet");
    }
  }, [googleResponse, haandterOAuthCallback]);

  // Håndter OAuth-callback på web (token i URL-hash fra implicit flow)
  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const hash = window.location.hash;
      if (hash && hash.includes("access_token")) {
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get("access_token");
        if (accessToken) {
          window.history.replaceState(null, "", window.location.pathname);
          haandterOAuthCallback("google", accessToken);
        }
      }
    }
  }, [haandterOAuthCallback]);

  if (erInnlogget) {
    return <Redirect href="/(tabs)/hjem" />;
  }

  const handleGoogleLogin = () => {
    harHaandtertResponse.current = false;
    setFeilmelding(null);
    if (Platform.OS === "web") {
      loggInnMedGoogle();
    } else {
      googlePromptAsync();
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center px-8">
        {/* Logo */}
        <View className="mb-12 items-center">
          <Text className="text-4xl font-bold text-sitedoc-blue">
            {t("app.navn")}
          </Text>
          <Text className="mt-2 text-base text-gray-500">
            {t("app.tagline")}
          </Text>
        </View>

        {/* Innloggingsknapper */}
        <View className="w-full gap-4">
          <Pressable
            onPress={handleGoogleLogin}
            disabled={laster || (Platform.OS !== "web" && !googleRequest)}
            className="flex-row items-center justify-center rounded-lg border border-gray-300 bg-white px-6 py-4 active:bg-gray-50"
          >
            <Text className="text-base font-medium text-gray-700">
              {t("auth.loggInnGoogle")}
            </Text>
          </Pressable>

          <Pressable
            onPress={loggInnMedMicrosoft}
            disabled={laster}
            className="flex-row items-center justify-center rounded-lg bg-[#2f2f2f] px-6 py-4 active:bg-[#1a1a1a]"
          >
            <Text className="text-base font-medium text-white">
              {t("auth.loggInnMicrosoft")}
            </Text>
          </Pressable>
        </View>

        {laster && (
          <Text className="mt-4 text-sm text-gray-400">{t("auth.loggerInn")}</Text>
        )}

        {feilmelding && (
          <Text className="mt-4 text-sm text-red-500">{feilmelding}</Text>
        )}
      </View>
    </SafeAreaView>
  );
}
