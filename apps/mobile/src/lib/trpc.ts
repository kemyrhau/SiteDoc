import { createTRPCReact, httpBatchLink } from "@trpc/react-query";
import type { AppRouter } from "@sitedoc/api/src/trpc/router";
import { AUTH_CONFIG } from "../config/auth";
import { hentSessionToken, lagreSessionToken } from "../services/auth";

export const trpc = createTRPCReact<AppRouter>();

export function opprettTrpcKlient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${AUTH_CONFIG.apiUrl}/trpc`,
        async headers() {
          const token = await hentSessionToken();
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
        // H1 mobil-token-rotasjon: server roterer Session.sessionToken når
        // gammel token er > 7 dager. Nytt token sendes via X-Session-Token
        // respons-header. Skriv det til SecureStore — neste request bruker
        // automatisk det nye tokenet via `headers()` over.
        async fetch(input, init) {
          const response = await fetch(input, init);
          const nyttToken = response.headers.get("x-session-token");
          if (nyttToken) {
            try {
              await lagreSessionToken(nyttToken);
            } catch {
              // SecureStore-feil skal ikke velte respons — token brukes
              // bare ved neste request og gammel token er fortsatt gyldig
              // inntil server roterer på nytt.
            }
          }
          return response;
        },
      }),
    ],
  });
}
