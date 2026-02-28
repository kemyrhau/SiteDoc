import type { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "@siteflow/db";

export interface CreateContextOptions {
  req: FastifyRequest;
  res: FastifyReply;
}

/**
 * Opprett tRPC-kontekst for hver forespørsel.
 * Inkluderer databasetilkobling og brukerinfo (fra Clerk i Fase 4).
 */
export async function createContext({ req, res }: CreateContextOptions) {
  // TODO Fase 4: Hent bruker fra Clerk-token
  const userId = req.headers["x-user-id"] as string | undefined;

  return {
    prisma,
    req,
    res,
    userId,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
