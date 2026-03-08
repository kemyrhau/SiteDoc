import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { AUTH_CONFIG, GOOGLE_AUTH, MICROSOFT_AUTH } from "../config/auth";

WebBrowser.maybeCompleteAuthSession();

const SESSION_TOKEN_KEY = "sitedoc_session_token";
const USER_DATA_KEY = "sitedoc_user_data";

export interface BrukerData {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

// --- Plattformspesifikk lagring (SecureStore på native, localStorage på web) ---

async function lagreVerdi(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(key, value);
  } else {
    const SecureStore = await import("expo-secure-store");
    await SecureStore.setItemAsync(key, value);
  }
}

async function hentVerdi(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem(key);
  }
  const SecureStore = await import("expo-secure-store");
  return SecureStore.getItemAsync(key);
}

async function slettVerdi(key: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.removeItem(key);
  } else {
    const SecureStore = await import("expo-secure-store");
    await SecureStore.deleteItemAsync(key);
  }
}

export async function lagreSessionToken(token: string): Promise<void> {
  await lagreVerdi(SESSION_TOKEN_KEY, token);
}

export async function hentSessionToken(): Promise<string | null> {
  return hentVerdi(SESSION_TOKEN_KEY);
}

export async function slettSessionToken(): Promise<void> {
  await slettVerdi(SESSION_TOKEN_KEY);
}

export async function lagreBrukerData(bruker: BrukerData): Promise<void> {
  await lagreVerdi(USER_DATA_KEY, JSON.stringify(bruker));
}

export async function hentBrukerData(): Promise<BrukerData | null> {
  const data = await hentVerdi(USER_DATA_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function slettBrukerData(): Promise<void> {
  await slettVerdi(USER_DATA_KEY);
}

// --- OAuth-flyt ---

function hentRedirectUri(): string {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    // På web: bruk origin + /logg-inn (der vi håndterer callback)
    return `${window.location.origin}/logg-inn`;
  }
  return AuthSession.makeRedirectUri({ scheme: "sitedoc" });
}

export function loggInnMedGoogleWeb(): void {
  const redirectUri = hentRedirectUri();
  const params = new URLSearchParams({
    client_id: AUTH_CONFIG.googleClientId,
    redirect_uri: redirectUri,
    response_type: "token",
    scope: "openid email profile",
    state: Math.random().toString(36).substring(2),
  });
  window.location.href = `${GOOGLE_AUTH.authorizationEndpoint}?${params.toString()}`;
}

export async function loggInnMedMicrosoft(): Promise<string | null> {
  const redirectUri = hentRedirectUri();

  const request = new AuthSession.AuthRequest({
    clientId: AUTH_CONFIG.microsoftClientId,
    redirectUri,
    scopes: ["openid", "email", "profile", "User.Read"],
    responseType: AuthSession.ResponseType.Token,
    usePKCE: false,
  });

  const result = await request.promptAsync({
    authorizationEndpoint: MICROSOFT_AUTH.authorizationEndpoint,
  });

  if (result.type === "success" && result.authentication?.accessToken) {
    return result.authentication.accessToken;
  }

  return null;
}

export async function loggUt(): Promise<void> {
  // Slett sesjon server-side
  try {
    const token = await hentSessionToken();
    if (token) {
      await fetch(`${AUTH_CONFIG.apiUrl}/trpc/mobilAuth.loggUt`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
    }
  } catch {
    // Nettverksfeil — fortsett med lokal opprydding uansett
  }
  await slettSessionToken();
  await slettBrukerData();
}
