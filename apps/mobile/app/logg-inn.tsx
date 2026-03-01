import { useEffect } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect } from "expo-router";
import { useAuth } from "../src/providers/AuthProvider";

export default function LoggInnSkjerm() {
  const { loggInnMedGoogle, loggInnMedMicrosoft, haandterOAuthCallback, erInnlogget, laster } = useAuth();

  // Håndter OAuth-callback på web (token i URL-hash)
  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const hash = window.location.hash;
      if (hash && hash.includes("access_token")) {
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get("access_token");
        if (accessToken) {
          // Rydd opp URL-en
          window.history.replaceState(null, "", window.location.pathname);
          haandterOAuthCallback("google", accessToken);
        }
      }
    }
  }, [haandterOAuthCallback]);

  if (erInnlogget) {
    return <Redirect href="/(tabs)/hjem" />;
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center px-8">
        {/* Logo */}
        <View className="mb-12 items-center">
          <Text className="text-4xl font-bold text-siteflow-blue">
            SiteFlow
          </Text>
          <Text className="mt-2 text-base text-gray-500">
            Rapport- og kvalitetsstyring
          </Text>
        </View>

        {/* Innloggingsknapper */}
        <View className="w-full gap-4">
          <Pressable
            onPress={loggInnMedGoogle}
            disabled={laster}
            className="flex-row items-center justify-center rounded-lg border border-gray-300 bg-white px-6 py-4 active:bg-gray-50"
          >
            <Text className="text-base font-medium text-gray-700">
              Logg inn med Google
            </Text>
          </Pressable>

          <Pressable
            onPress={loggInnMedMicrosoft}
            disabled={laster}
            className="flex-row items-center justify-center rounded-lg bg-[#2f2f2f] px-6 py-4 active:bg-[#1a1a1a]"
          >
            <Text className="text-base font-medium text-white">
              Logg inn med Microsoft 365
            </Text>
          </Pressable>
        </View>

        {laster && (
          <Text className="mt-4 text-sm text-gray-400">Logger inn...</Text>
        )}
      </View>
    </SafeAreaView>
  );
}
