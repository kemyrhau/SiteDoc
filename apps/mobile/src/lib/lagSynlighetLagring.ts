import { Platform } from "react-native";

// F2 (spec § 3, Q4): husker lagsynlighet pr. tegning pr. bruker PÅ ENHETEN. Web
// bruker `localStorage` (`tegninger/page.tsx`); mobilplanen (§ 4) nevnte
// `AsyncStorage`, men `@react-native-async-storage/async-storage` er IKKE
// installert noe sted i repoet i dag (MÅLT: `find node_modules` gir null treff) —
// et NYTT NATIVT bibliotek kan ikke virke i det allerede bygde test-binæret uten
// et nytt EAS-bygg, nøyaktig samme felleklasse "SVAR MOBILPLAN" punkt 1 unngikk
// for asset-spørsmålet. `expo-secure-store` er derimot allerede linket i appen
// (brukt av `services/auth.ts`/`SpraakProvider`) — samme plattform-mønster
// (SecureStore native / localStorage web) som den filen allerede bruker, men
// holdt som en EGEN, lett modul her (ikke en import av `services/auth.ts`, som
// drar med seg `expo-auth-session`/`expo-web-browser`).
//
// Lagrer KUN de SKJULTE lagnavnene (ikke hele `Record<string, boolean>` som web
// gjør i localStorage) — holder payloaden liten, siden SecureStore/Keychain har
// en praktisk størrelsesgrense pr. verdi, og de fleste brukere skjuler et fåtall
// lag, ikke alle 50+.

function lagringsnoekkel(drawingId: string): string {
  return `sitedoc_tegning_lag_skjult_${drawingId}`;
}

async function hentRaa(noekkel: string): Promise<string | null> {
  if (Platform.OS === "web") return localStorage.getItem(noekkel);
  const SecureStore = await import("expo-secure-store");
  return SecureStore.getItemAsync(noekkel);
}

async function lagreRaa(noekkel: string, verdi: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(noekkel, verdi);
    return;
  }
  const SecureStore = await import("expo-secure-store");
  await SecureStore.setItemAsync(noekkel, verdi);
}

async function slettRaa(noekkel: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.removeItem(noekkel);
    return;
  }
  const SecureStore = await import("expo-secure-store");
  await SecureStore.deleteItemAsync(noekkel);
}

export async function hentSkjulteLag(drawingId: string): Promise<string[]> {
  try {
    const raw = await hentRaa(lagringsnoekkel(drawingId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export async function lagreSkjulteLag(drawingId: string, skjulteLag: string[]): Promise<void> {
  try {
    const noekkel = lagringsnoekkel(drawingId);
    if (skjulteLag.length === 0) {
      await slettRaa(noekkel);
      return;
    }
    await lagreRaa(noekkel, JSON.stringify(skjulteLag));
  } catch {
    /* privat modus/full lagring — synligheten virker fortsatt denne økten, som på web */
  }
}

/** Utleder `{navn: synlig}` fra en liste skjulte lagnavn, for å gi samme
 * `Record<string, boolean>`-form som lagpanel-komponentene (og web) bruker.
 * Fravær av nøkkel = synlig (default), som på web. */
export function byggSynlighetFraSkjulte(skjulteLag: string[]): Record<string, boolean> {
  const synlighet: Record<string, boolean> = {};
  for (const navn of skjulteLag) synlighet[navn] = false;
  return synlighet;
}

/** Motsatt vei: hvilke lagnavn er FAKTISK skjult i et `Record<string, boolean>`
 * (fravær av nøkkel = synlig), for å lagre etter en endring. */
export function utledSkjulteLag(synlighet: Record<string, boolean>): string[] {
  return Object.entries(synlighet)
    .filter(([, synlig]) => synlig === false)
    .map(([navn]) => navn);
}
