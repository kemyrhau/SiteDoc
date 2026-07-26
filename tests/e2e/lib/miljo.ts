/**
 * Miljø-bootstrap for e2e-suiten.
 *
 * Én dokumentert kilde for hemmelighet + URL-er: `tests/e2e/.env.local`
 * (gitignored) lastes via dotenv. Ingen lesing fra rot-.env eller vilkårlig
 * prosess-env — det er nettopp env-flikkingen riggen skal fjerne.
 */
import { config as lastEnv } from "dotenv";
import { resolve } from "node:path";

// Playwright transpilerer til CommonJS → __dirname er tilgjengelig.
export const E2E_ROT = resolve(__dirname, "..");

// Last tests/e2e/.env.local (overstyrer ikke ekte prosess-env hvis satt der).
lastEnv({ path: resolve(E2E_ROT, ".env.local") });

export const BASE_URL = process.env.E2E_BASE_URL ?? "https://test.sitedoc.no";
export const API_URL = process.env.E2E_API_URL ?? "https://api-test.sitedoc.no";

/** Whitelistede testbrukere (må matche seed + dev-login-whitelist). */
export const TESTBRUKERE = {
  firma: "test-firma@sitedoc.test", // company_admin + prosjektadmin → driver
  arbeider: "test-arbeider@sitedoc.test", // menig utfører → rolle-tester
  admin: "test-admin@sitedoc.test", // sitedoc_admin → login-røyktest
} as const;

export type Rolle = keyof typeof TESTBRUKERE;

/** Agent-testprosjektet (seedet av seed-testbrukere.ts + seed-e2e-flyt.ts). */
export const AGENT_PROSJEKT_NUMMER = "AGENT-TEST-0001";

/** Cookie-navn: https → __Secure-prefiks (Auth.js host-only session-cookie). */
export const COOKIE_NAVN = BASE_URL.startsWith("https")
  ? "__Secure-authjs.session-token"
  : "authjs.session-token";

export const AUTH_DIR = resolve(E2E_ROT, ".auth");
export const RUNTIME_FIL = resolve(E2E_ROT, ".runtime.json");

/** Kjørings-prefiks: alle dokumenter riggen lager bærer dette → rydd-signatur. */
export function nyRunId(): string {
  return `E2E-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** Hemmeligheten er kun påkrevd i global-setup (token-minting). Tydelig feil. */
export function krevDevLoginSecret(): string {
  const s = process.env.DEV_LOGIN_SECRET;
  if (!s) {
    throw new Error(
      "DEV_LOGIN_SECRET mangler. Legg den i tests/e2e/.env.local " +
        "(se .env.local.example). Den committes aldri — bor i server-.env.",
    );
  }
  return s;
}

/** Runtime-data delt fra global-setup til testene (ids + tokens). Gitignored. */
export interface Runtime {
  runId: string;
  projectId: string;
  dokumentflytId: string;
  bestillerFaggruppeId: string;
  utforerFaggruppeId: string;
  templateId: string;
  /** Antall distinkte rolle-ledd i flyten (regresjonsassert for byggLedd). */
  antallLedd: number;
  tokens: Record<Rolle, string>;
}
