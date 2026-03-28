import type { FastifyInstance } from "fastify";
import { prisma } from "@sitedoc/db";
import { prosesserDokument } from "../services/ftd-prosessering";

export async function prosesserRoute(server: FastifyInstance) {
  // Intern endepunkt for å trigge dokumentprosessering
  // Kalles fra tRPC (Next.js) via HTTP til API-serveren
  server.post<{ Params: { documentId: string } }>(
    "/prosesser/:documentId",
    async (req, reply) => {
      const { documentId } = req.params;

      if (!documentId) {
        return reply.status(400).send({ error: "Mangler documentId" });
      }

      // Fire-and-forget — returner umiddelbart
      prosesserDokument(prisma, documentId).catch((err) => {
        console.error(`FTD prosessering feilet for ${documentId}:`, err);
      });

      return reply.send({ ok: true, documentId });
    },
  );
}
