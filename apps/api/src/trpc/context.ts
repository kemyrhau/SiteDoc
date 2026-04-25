import type { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "@sitedoc/db";
import { prismaMaskin } from "@sitedoc/db-maskin";

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

  // Hent sesjonstoken fra cookie eller Authorization-header
  const cookieHeader = req.headers.cookie ?? "";
  const sessionTokenMatch = cookieHeader.match(
    /(?:__Secure-)?authjs\.session-token=([^;]+)/,
  );
  const sessionToken =
    sessionTokenMatch?.[1] ??
    req.headers.authorization?.replace("Bearer ", "") ??
    null;

  if (sessionToken) {
    try {
      // Slå opp sesjonen direkte i databasen (Auth.js database-strategi)
      const session = await prisma.session.findUnique({
        where: { sessionToken },
        select: { userId: true, expires: true },
      });

      if (session && session.expires > new Date()) {
        userId = session.userId;
      }
    } catch {
      // Ugyldig token — bruker forblir uautentisert
    }
  }

  return {
    prisma,
    prismaMaskin,
    req,
    res,
    userId,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
