import type { FastifyInstance } from "fastify";
import { randomBytes } from "crypto";
import { prisma } from "@sitedoc/db";

/**
 * Dev-bypass-innlogging for mobil-simulator. Plain Fastify-route — ikke tRPC.
 *
 * Aktiv kun når:
 *   - NODE_ENV !== "production"  (lokal `pnpm dev`)
 *   - ELLER ENABLE_DEV_LOGIN === "true" (eksplisitt opt-in på test-server)
 *
 * Plassert på Fastify (apps/api) framfor Next.js (apps/web) fordi mobilen
 * allerede treffer api-test.sitedoc.no for tRPC og vi vet det fungerer fra
 * iOS Simulator. test.sitedoc.no har Cloudflare WAF-rules som blokkerer
 * Expo Go's User-Agent.
 *
 * Returnerer en gyldig session-token for hardkodet test-bruker
 * (kemyrhau@gmail.com — Kenneth). Ingen ny bruker opprettes — hvis test-
 * brukeren ikke finnes returneres 404 med beskjed om å logge inn vanlig først.
 */

const TEST_BRUKER_EMAIL = "kemyrhau@gmail.com";

export function erDevLoginAktiv(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  if (process.env.ENABLE_DEV_LOGIN === "true") return true;
  return false;
}

export async function devLoginRoute(server: FastifyInstance) {
  // GET — diagnose-endpoint som viser om dev-login er aktiv
  server.get("/dev-login", async (_req, reply) => {
    return reply.send({
      aktiv: true,
      testBruker: TEST_BRUKER_EMAIL,
      melding: "POST hit for å bytte mot session-token",
    });
  });

  // POST — bytt mot session-token for test-bruker
  server.post("/dev-login", async (_req, reply) => {
    const bruker = await prisma.user.findFirst({
      where: { email: TEST_BRUKER_EMAIL, canLogin: true },
      orderBy: { createdAt: "asc" },
    });

    if (!bruker) {
      return reply.status(404).send({
        error: "TEST_BRUKER_MANGLER",
        melding: `Test-bruker ${TEST_BRUKER_EMAIL} finnes ikke i denne databasen. Logg inn med vanlig OAuth først.`,
      });
    }

    const sessionToken = randomBytes(32).toString("hex");
    const expires = new Date();
    expires.setDate(expires.getDate() + 30);

    await prisma.session.create({
      data: {
        sessionToken,
        userId: bruker.id,
        expires,
      },
    });

    return reply.send({
      sessionToken,
      user: {
        id: bruker.id,
        name: bruker.name,
        email: bruker.email,
        image: bruker.image,
      },
    });
  });
}
