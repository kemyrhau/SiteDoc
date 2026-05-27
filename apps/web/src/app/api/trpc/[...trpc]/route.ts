import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@sitedoc/api/src/trpc/router";
import { prisma } from "@sitedoc/db";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaVarelager } from "@sitedoc/db-varelager";
import { auth } from "@/auth";

/**
 * Next.js API-rute som håndterer tRPC-forespørsler direkte.
 * Bruker Auth.js-sesjon for autentisering.
 *
 * Impersonering: hvis session-raden har impersonatedUserId og det ikke
 * er utløpt, brukes target som effektiv userId. actualUserId beholdes
 * for audit-spor.
 */
async function handler(req: Request) {
  const session = await auth();
  const sessionUserId = session?.user?.id ?? null;

  let userId: string | null = sessionUserId;
  let actualUserId: string | null = sessionUserId;
  let imperseringAktiv = false;
  let sessionToken: string | null = null;

  // Hent session-token fra cookie så impersonerings-mutasjoner kan oppdatere
  // riktig session-rad. Headers er fetch-Request (Web API), så vi må bruke
  // .get("cookie") — IKKE .cookie-property.
  const cookieHeader = req.headers.get("cookie") ?? "";
  const sessionTokenMatch = cookieHeader.match(
    /(?:__Secure-)?authjs\.session-token=([^;]+)/,
  );
  if (sessionTokenMatch?.[1]) {
    sessionToken = decodeURIComponent(sessionTokenMatch[1]);
  }

  // Slå opp impersonering-felter direkte fra session-raden.
  if (sessionUserId && sessionToken) {
    try {
      const rad = await prisma.session.findUnique({
        where: { sessionToken },
        select: { impersonatedUserId: true, impersonationExpiresAt: true },
      });
      const harGyldig =
        !!rad?.impersonatedUserId &&
        !!rad.impersonationExpiresAt &&
        rad.impersonationExpiresAt > new Date();
      if (harGyldig) {
        userId = rad!.impersonatedUserId!;
        imperseringAktiv = true;
      }
    } catch {
      // Stille fallback — bruker forblir ikke-impersonert
    }
  }

  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => ({
      prisma,
      prismaMaskin,
      prismaTimer,
      prismaVarelager,
      req: req as never,
      res: {} as never,
      userId,
      actualUserId,
      imperseringAktiv,
      sessionToken,
      // Web-flyten er alltid cookie-basert (Auth.js eier rotasjon).
      // mobilTokenRotasjon-middleware sjekker tokenKilde === "bearer"
      // og hopper over web — feltene er bare med for type-kompatibilitet.
      tokenKilde: (sessionToken ? "cookie" : null) as "bearer" | "cookie" | null,
      nyttSessionTokenForRespons: { value: null as string | null },
    }),
  });
}

export { handler as GET, handler as POST };
