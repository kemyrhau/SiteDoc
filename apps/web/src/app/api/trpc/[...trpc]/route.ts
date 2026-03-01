import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@siteflow/api/src/trpc/router";
import { prisma } from "@siteflow/db";
import { auth } from "@/auth";

/**
 * Next.js API-rute som håndterer tRPC-forespørsler direkte.
 * Bruker Auth.js-sesjon for autentisering.
 */
async function handler(req: Request) {
  const session = await auth();

  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => ({
      prisma,
      req: {} as never,
      res: {} as never,
      userId: session?.user?.id ?? null,
    }),
  });
}

export { handler as GET, handler as POST };
