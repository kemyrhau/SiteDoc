import { Linking } from "react-native";

/**
 * Åpner en ekstern lenke (tel:/mailto:) trygt. Returnerer `false` hvis lenken
 * ikke kan åpnes (f.eks. `mailto:` i iOS-simulator uten Mail-app) — kalleren
 * viser da en stille fallback i stedet for en rå «Unable to open URL»-feil.
 * Kaster aldri.
 */
export async function apnLenke(url: string): Promise<boolean> {
  try {
    if (await Linking.canOpenURL(url)) {
      await Linking.openURL(url);
      return true;
    }
  } catch {
    // Svelg — ingen rå uncaught-feil skal nå brukeren.
  }
  return false;
}
