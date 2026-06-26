import { Platform } from "react-native";

export const AUTH_CONFIG = {
  googleClientId: Platform.OS === "ios"
    ? (process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "")
    : (process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? ""),
  microsoftClientId: process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID ?? "",
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001",
} as const;

/**
 * True når en ekte Microsoft client-id er konfigurert. "disabled" er
 * placeholder-verdien i eas.json for profiler der MS ikke skal være på —
 * MS-knappen skjules da, så ingen møter en død knapp.
 */
export const erMicrosoftKonfigurert =
  AUTH_CONFIG.microsoftClientId !== "" &&
  AUTH_CONFIG.microsoftClientId !== "disabled";

/** Web-base URL for filnedlasting og mobil-viewer (uten /trpc, uten api-prefiks) */
export function hentWebUrl(): string {
  const url = AUTH_CONFIG.apiUrl.replace("/trpc", "");
  // api.sitedoc.no → sitedoc.no, api-test.sitedoc.no → test.sitedoc.no
  return url.replace("://api.", "://").replace("://api-", "://");
}

// OAuth-endepunkter
export const GOOGLE_AUTH = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
};

export const MICROSOFT_AUTH = {
  authorizationEndpoint:
    "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
  tokenEndpoint:
    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
};
