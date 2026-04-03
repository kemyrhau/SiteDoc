import "../src/global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Providers } from "../src/providers";

export default function RotLayout() {
  return (
    <Providers>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="logg-inn" />
        <Stack.Screen name="sjekkliste" />
        <Stack.Screen name="oppgave" />
        <Stack.Screen name="dokument" />
        <Stack.Screen name="psi" />
        <Stack.Screen name="3d-visning" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="tegning-3d" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="live-view" options={{ animation: "slide_from_right" }} />
      </Stack>
    </Providers>
  );
}
