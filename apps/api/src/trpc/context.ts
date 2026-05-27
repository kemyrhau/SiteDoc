import type { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "@sitedoc/db";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaVarelager } from "@sitedoc/db-varelager";

export interface CreateContextOptions {
  req: FastifyRequest;
  res: FastifyReply;
}

/**
 * Opprett tRPC-kontekst for hver forespørsel.
 * Verifiserer sesjonstoken fra Auth.js via database-oppslag.
 */
export async function createContext({ req, res }: CreateContextOptions) {
  let userId: string | null = null;
  let actualUserId: string | null = null;
  let imperseringAktiv = false;

  // Hent sesjonstoken fra cookie eller Authorization-header.
  // Spor kilden — mobil-rotasjons-middleware (H1) skal kun rotere bearer-
  // tokens. Web-cookie eies av Auth.js og roteres ikke av oss.
  const cookieHeader = req.headers.cookie ?? "";
  const sessionTokenMatch = cookieHeader.match(
    /(?:__Secure-)?authjs\.session-token=([^;]+)/,
  );
  const bearerToken =
    req.headers.authorization?.replace("Bearer ", "") ?? null;
  const sessionToken = sessionTokenMatch?.[1] ?? bearerToken ?? null;
  const tokenKilde: "bearer" | "cookie" | null = sessionTokenMatch?.[1]
    ? "cookie"
    : bearerToken
      ? "bearer"
      : null;

  // Mutable container for nytt rotert token. Middleware (trinn 3) skriver
  // hit; tRPC responseMeta leser og setter X-Session-Token-header på respons.
  const nyttSessionTokenForRespons: { value: string | null } = { value: null };

  if (sessionToken) {
    try {
      // Slå opp sesjonen direkte i databasen (Auth.js database-strategi)
      const session = await prisma.session.findUnique({
        where: { sessionToken },
        select: {
          userId: true,
          expires: true,
          impersonatedUserId: true,
          impersonationExpiresAt: true,
        },
      });

      if (session && session.expires > new Date()) {
        // Impersonering: hvis admin har aktiv impersonering, bruk
        // impersonatedUserId som effektiv userId for autorisering. Holder
        // actualUserId = admin for audit-logging.
        const harGyldigImpersonering =
          !!session.impersonatedUserId &&
          !!session.impersonationExpiresAt &&
          session.impersonationExpiresAt > new Date();

        actualUserId = session.userId;
        userId = harGyldigImpersonering
          ? session.impersonatedUserId!
          : session.userId;
        imperseringAktiv = harGyldigImpersonering;
      }
    } catch {
      // Ugyldig token — bruker forblir uautentisert
    }
  }

  return {
    prisma,
    prismaMaskin,
    prismaTimer,
    prismaVarelager,
    req,
    res,
    userId,
    actualUserId,
    imperseringAktiv,
    sessionToken,
    tokenKilde,
    nyttSessionTokenForRespons,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
