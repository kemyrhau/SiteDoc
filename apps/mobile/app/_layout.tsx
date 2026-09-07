import "../src/global.css";
import { useEffect } from "react";
import {
  Stack,
  useRouter,
  useSegments,
  useRootNavigationState,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Providers } from "../src/providers";
import { useAuth } from "../src/providers/AuthProvider";

export default function RotLayout() {
  return (
    <Providers>
      <StatusBar style="light" />
      <AuthGate />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="logg-inn" />
        <Stack.Screen name="sjekkliste" />
        <Stack.Screen name="oppgave" />
        <Stack.Screen name="innboks" />
        <Stack.Screen name="dokument" />
        <Stack.Screen name="psi" />
        <Stack.Screen name="kontakter" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="3d-visning" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="tegning-3d" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="live-view" options={{ animation: "slide_from_right" }} />
      </Stack>
    </Providers>
  );
}

/**
 * Rot-nivå auth-gate. Redirecter til /logg-inn så snart `erInnlogget` blir false,
 * uansett hvilken rute brukeren står på — også root-stack-ruter OVER fanene
 * (timer/[id], sjekkliste/[id], hms/…), som en gate i (tabs)/_layout.tsx ikke ville
 * nådd. Erstatter fangenskapet der `loggUt` satte bruker=null uten navigasjon og
 * redirecten kun fantes i index.tsx (rot-ruten `/`).
 *
 * `erInnlogget` er eneste sannhet: logout-knappen (mer.tsx) trenger ikke kjenne
 * navigasjon — den setter bruker=null, gaten gjør resten.
 *
 * NB — to logout-veier ved design: denne gaten fanger den STATE-baserte
 * utloggingen (knapp, og framtidig sesjonsbortfall som nullstiller `bruker`). Den
 * globale UNAUTHORIZED-handleren i providers/index.tsx navigerer SELV imperativt
 * fordi den bruker service-`loggUt` (rører ikke React-staten) — derfor fyrer ikke
 * denne gaten på den veien, og de er bevisst adskilte.
 */
function AuthGate() {
  const { erInnlogget, laster } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const navState = useRootNavigationState();

  useEffect(() => {
    // Ikke naviger før rot-navigatoren er montert (ellers kaster expo-router).
    if (!navState?.key) return;
    if (laster) return;
    const paaLoggInn = segments[0] === "logg-inn";
    if (!erInnlogget && !paaLoggInn) {
      router.replace("/logg-inn");
    }
  }, [erInnlogget, laster, segments, router, navState?.key]);

  return null;
}
