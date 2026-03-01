import { Platform } from "react-native";

export const AUTH_CONFIG = {
  googleClientId: Platform.OS === "ios"
    ? (process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "")
    : (process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? ""),
  microsoftClientId: process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID ?? "",
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001",
} as const;

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
