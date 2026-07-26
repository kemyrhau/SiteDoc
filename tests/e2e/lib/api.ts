/**
 * Tynn tRPC-over-HTTP-klient for e2e-setup/rydding.
 *
 * Serveren kjører uten transformer (ren JSON) og aksepterer ikke-batch-kall:
 *   query    → GET  /trpc/<proc>?input=<json>
 *   mutation → POST /trpc/<proc>  body=<json>
 * Auth via `Authorization: Bearer <sessionToken>` (samme som mobil).
 */
import { API_URL, krevDevLoginSecret } from "./miljo";

export interface DevLoginSvar {
  sessionToken: string;
  user: { id: string; name: string | null; email: string; role: string };
}

/** Mint et session-token for en whitelistet testbruker (test-miljø, gated). */
export async function devLogin(email: string): Promise<DevLoginSvar> {
  const res = await fetch(`${API_URL}/dev-login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-dev-login-secret": krevDevLoginSecret(),
    },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const tekst = await res.text().catch(() => "");
    throw new Error(`dev-login feilet for ${email}: ${res.status} ${tekst}`);
  }
  return (await res.json()) as DevLoginSvar;
}

function tolkTrpc<T>(kropp: unknown): T {
  // Ikke-batch: { result: { data } } | { error: {...} }. Batch: [ ... ].
  const enkelt = Array.isArray(kropp) ? kropp[0] : kropp;
  const obj = enkelt as {
    result?: { data?: T };
    error?: { message?: string; code?: number; data?: { code?: string } };
  };
  if (obj?.error) {
    const m = obj.error.message ?? "ukjent tRPC-feil";
    throw new Error(`tRPC-feil: ${m}`);
  }
  return obj?.result?.data as T;
}

export class ApiKlient {
  constructor(private readonly token: string) {}

  private headers(ekstra?: Record<string, string>): Record<string, string> {
    return { Authorization: `Bearer ${this.token}`, ...ekstra };
  }

  async query<T = unknown>(proc: string, input?: unknown): Promise<T> {
    const url = new URL(`${API_URL}/trpc/${proc}`);
    if (input !== undefined) url.searchParams.set("input", JSON.stringify(input));
    const res = await fetch(url, { headers: this.headers() });
    const kropp = await res.json().catch(() => ({}));
    if (!res.ok && !(kropp as { error?: unknown }).error) {
      throw new Error(`tRPC ${proc} → HTTP ${res.status}`);
    }
    return tolkTrpc<T>(kropp);
  }

  async mutation<T = unknown>(proc: string, input: unknown): Promise<T> {
    const res = await fetch(`${API_URL}/trpc/${proc}`, {
      method: "POST",
      headers: this.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(input),
    });
    const kropp = await res.json().catch(() => ({}));
    if (!res.ok && !(kropp as { error?: unknown }).error) {
      throw new Error(`tRPC ${proc} → HTTP ${res.status}`);
    }
    return tolkTrpc<T>(kropp);
  }
}
