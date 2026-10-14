import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useAuth } from "../src/providers/AuthProvider";
import WebglSmoketest from "../src/devHarness/WebglSmoketest";

export default function Index() {
  const { erInnlogget, laster } = useAuth();

  // ENGANGS-RØYKTEST (mobil leveranse 1, arbeidstegning-f1): kun denne engangs-
  // branchen, aldri satt i noe commit til develop/main. Se devHarness/WebglSmoketest.tsx.
  if (process.env.EXPO_PUBLIC_WEBGL_SMOKETEST === "1") {
    return <WebglSmoketest />;
  }

  if (laster) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#1e40af" />
      </View>
    );
  }

  if (erInnlogget) {
    return <Redirect href="/(tabs)/hjem" />;
  }

  return <Redirect href="/logg-inn" />;
}
