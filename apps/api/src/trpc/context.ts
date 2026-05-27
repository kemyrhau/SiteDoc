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
 * Input til lagContextStamme — alt som auth-flyten har utledet og som
 * helperen ikke kan utlede selv (varierer mellom runtimes).
 */
export interface ContextStammeInput {
  userId: string | null;
  actualUserId: string | null;
  imperseringAktiv: boolean;
  sessionToken: string | null;
  tokenKilde: "bearer" | "cookie" | null;
}

/**
 * Felles Context-stamme delt mellom Fastify-createContext (api) og
 * Next.js-tRPC-routen (web). Bygger alle Context-felter unntatt req/res
 * — de tilhører ulike runtimes (FastifyRequest vs Web Request) og må
 * settes per side.
 *
 * Hvorfor: H1-deploy 2026-05-27 viste at web-routen som dupliserer
 * Context-bygging ikke fanges av API-typecheck når Context utvides.
 * lagContextStamme er ett sted å legge til nye felter — TypeScript-
 * kompilatoren tvinger oppdatering av begge kallsteder via input-typen.
 */
export function lagContextStamme(input: ContextStammeInput) {
  return {
    prisma,
    prismaMaskin,
    prismaTimer,
    prismaVarelager,
    userId: input.userId,
    actualUserId: input.actualUserId,
    imperseringAktiv: input.imperseringAktiv,
    sessionToken: input.sessionToken,
    tokenKilde: input.tokenKilde,
    // Mutable container for nytt rotert token. Middleware skriver hit;
    // tRPC responseMeta leser og setter X-Session-Token-header på respons.
    nyttSessionTokenForRespons: { value: null as string | null },
  };
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
    ...lagContextStamme({
      userId,
      actualUserId,
      imperseringAktiv,
      sessionToken,
      tokenKilde,
    }),
    req,
    res,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
