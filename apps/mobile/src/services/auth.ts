import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { AUTH_CONFIG, MICROSOFT_AUTH } from "../config/auth";

WebBrowser.maybeCompleteAuthSession();

const SESSION_TOKEN_KEY = "sitedoc_session_token";
const USER_DATA_KEY = "sitedoc_user_data";

export interface BrukerData {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  language?: string;
}

// --- Plattformspesifikk lagring (SecureStore på native, localStorage på web) ---

export async function lagreVerdi(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(key, value);
  } else {
    const SecureStore = await import("expo-secure-store");
    await SecureStore.setItemAsync(key, value);
  }
}

export async function hentVerdi(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem(key);
  }
  const SecureStore = await import("expo-secure-store");
  return SecureStore.getItemAsync(key);
}

export async function slettVerdi(key: string): Promise<void> {
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
  // Native: sitedoc://auth. Path-segmentet ("auth") unngår trailing-slash-
  // mismatch mot Entra (URI uten path returneres med trailing slash) —
  // jf. låst redirect-design. Eneste native-konsument er Microsoft-flyten.
  return AuthSession.makeRedirectUri({ scheme: "sitedoc", path: "auth" });
}

export async function loggInnMedMicrosoft(): Promise<string | null> {
  const redirectUri = hentRedirectUri();
  const discovery = {
    authorizationEndpoint: MICROSOFT_AUTH.authorizationEndpoint,
    tokenEndpoint: MICROSOFT_AUTH.tokenEndpoint,
  };

  // Authorization code + PKCE — standarden for public/native-klient.
  // Public client = INGEN client-secret i appen; PKCE binder autorisasjons-
  // koden til denne enheten. (Implicit forkastes: Entra avviser for public
  // client, ingen refresh, token i redirect-URL.)
  //
  // Scope = kun OIDC-standarden `openid email profile`. `User.Read` (Graph)
  // er FJERNET: e-post, navn og oid ligger allerede i ID-tokenet fra `openid
  // profile email`, så vi trenger ingen Graph-tillatelse. Api-et leser oid
  // fra ID-tokenet (uendret providerAccountId), ikke lenger Graph /me.
  const request = new AuthSession.AuthRequest({
    clientId: AUTH_CONFIG.microsoftClientId,
    redirectUri,
    scopes: ["openid", "email", "profile"],
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
  });

  const result = await request.promptAsync(discovery);

  if (result.type !== "success" || !result.params.code) {
    return null;
  }

  // Veksle koden → tokens mot Entra token-endpoint. code_verifier er
  // PKCE-hemmeligheten generert ved promptAsync; sendes som extraParam.
  const tokenResultat = await AuthSession.exchangeCodeAsync(
    {
      clientId: AUTH_CONFIG.microsoftClientId,
      code: result.params.code,
      redirectUri,
      extraParams: { code_verifier: request.codeVerifier ?? "" },
    },
    discovery,
  );

  // Returner ID-tokenet (ikke access-tokenet). Api-et validerer signaturen mot
  // Entras JWKS og leser oid/email/name fra claims — ingen Graph-kall.
  return tokenResultat.idToken ?? null;
}

/**
 * Dev-bypass-innlogging for simulator. Treffer /dev-login på Fastify (apps/api).
 *
 * Ruten ligger på samme domene som tRPC (api-test.sitedoc.no) — ikke på
 * Next.js (test.sitedoc.no) — fordi Cloudflare WAF blokkerer Expo Go-fetch
 * mot test.sitedoc.no spesifikt.
 *
 * Server-siden registrerer ruten kun når:
 *   - NODE_ENV !== "production" (lokal dev)
 *   - eller ENABLE_DEV_LOGIN === "true" på test-server (sitedoc-test-api)
 *
 * 404 i prod. Returnerer en gyldig session-token for hardkodet test-bruker.
 *
 * MERK: Skal kun kalles fra UI som er gated bak `__DEV__`. Vi beskytter også
 * server-side, men UI-gate er førstelinjeforsvar mot å vise knappen i prod-bygg.
 */
export async function loggInnSomTestbruker(
  email?: string,
): Promise<{ user: BrukerData; sessionToken: string }> {
  const url = `${AUTH_CONFIG.apiUrl}/dev-login`;

  console.log("[DEV-LOGIN] Forsøker POST mot:", url, email ?? "(standard)");

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Nivå B: delt hemmelighet (kun i test-bundelen) — hindrer åpen
        // session-minting på test-nettet.
        "x-dev-login-secret": AUTH_CONFIG.devLoginSecret,
      },
      body: JSON.stringify(email ? { email } : {}),
    });
  } catch (e) {
    const melding = e instanceof Error ? e.message : "ukjent fetch-feil";
    console.warn("[DEV-LOGIN] Fetch kastet:", melding);
    throw new Error(`Fetch feilet mot ${url}: ${melding}`);
  }

  console.log("[DEV-LOGIN] Svar:", res.status);

  if (!res.ok) {
    const tekst = await res.text();
    if (res.status === 404) {
      throw new Error(
        `Dev-login ikke aktiv (${url} → 404). Sett ENABLE_DEV_LOGIN=true i sitedoc-test-api sin ecosystem.config.js, eller kjør \`pnpm dev\` lokalt.`,
      );
    }
    throw new Error(`Dev-login feilet (${res.status}): ${tekst}`);
  }

  const data = (await res.json()) as { sessionToken: string; user: BrukerData };
  await lagreSessionToken(data.sessionToken);
  await lagreBrukerData(data.user);
  return data;
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
